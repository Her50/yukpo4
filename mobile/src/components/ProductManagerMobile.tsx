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

// Types de produits disponibles
type ProductType =
    | 'immobilier_batiment'
    | 'immobilier_terrain'
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
    | 'aliments'
    | 'livres_fournitures'
    | 'quincaillerie'
    | 'prestation_service'
    | 'assurance'
    | 'pharmacie'
    | 'hopital_clinique'
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
    annee?: string;
    kilometrage?: string;
    couleur?: string;
    typeCarburant?: string;
    transmission?: string;

    // Ticket de voyage
    depart?: string;
    destination?: string;
    dateDepart?: string;
    heureDepart?: string;
    numeroPlace?: string;
    compagnieTransport?: string;

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

    // Ustensiles de Cuisine
    typeUstensile?: string; // Casserole, Poêle, Couteau, Mixer, etc.
    materiauUstensile?: string; // Inox, Aluminium, Plastique, Bois
    marqueUstensile?: string;
    capacite?: string; // Pour casseroles, mixers, etc.
    piecesDansSet?: string; // Nombre de pièces si set
    etatUstensile?: string;

    // Assurance
    typeAssurance?: string; // Auto, Santé, Habitation, Vie, etc.
    compagnieAssurance?: string; // Nom de la compagnie d'assurance
    couverture?: string; // Étendue de la couverture
    franchise?: string; // Montant de la franchise
    dureeContrat?: string; // 1 an, 2 ans, etc.
    primeAnnuelle?: string; // Prime annuelle
    benefices?: string; // Principaux bénéfices

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
    reference?: string;
    unite?: string; // Pièce, Sac, Litre, etc.
    stockDisponible?: string;

    // Prestation de Service
    imagesRealisations?: string[]; // Images de réalisations
    videosRealisations?: string[]; // Vidéos de réalisations
    titreService?: string; // Rempli automatiquement depuis bloc info générale
    descriptionService?: string; // Rempli automatiquement depuis bloc info générale

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
    { value: 'electromenager', label: 'Électroménager Domestique', icon: '🔌', color: '#14B8A6', description: 'Frigos, fours, machines à laver, micro-ondes' },
    { value: 'hopital_clinique', label: 'Établissements de Santé', icon: '🏥', color: '#DC2626', description: 'Hôpitaux, cliniques, centres médicaux, spécialités' },
    { value: 'image_son', label: 'Image et Son', icon: '📺', color: '#9C27B0', description: 'TV, home cinéma, enceintes, projecteurs, systèmes audio' },
    { value: 'immobilier_batiment', label: 'Immobilier - Bâtiments', icon: '🏢', color: '#3B82F6', description: 'Appartements, villas, maisons, immeubles' },
    { value: 'immobilier_terrain', label: 'Immobilier - Terrains', icon: '🏞️', color: '#10B981', description: 'Terrains constructibles, parcelles, lots' },
    { value: 'livres_fournitures', label: 'Livres et Fournitures Scolaires', icon: '📚', color: '#7C3AED', description: 'Manuels, livres, cahiers, stylos, fournitures' },
    { value: 'mobilier', label: 'Mobilier et Ameublement', icon: '🪑', color: '#F97316', description: 'Meubles salon, chambre, bureau, rangement' },
    { value: 'ordinateur', label: 'Ordinateurs et Informatique', icon: '💻', color: '#00BCD4', description: 'PC portables, bureaux, tablettes, accessoires' },
    { value: 'pharmacie', label: 'Pharmacies et Gardes', icon: '💊', color: '#059669', description: 'Pharmacies, planning de garde, services pharmaceutiques' },
    { value: 'prestation_service', label: 'Portfolio de Réalisations', icon: '🎯', color: '#8B5CF6', description: 'Galerie de vos prestations professionnelles' },
    { value: 'quincaillerie', label: 'Quincaillerie et Matériaux', icon: '🔨', color: '#F59E0B', description: 'Outils, matériaux, peintures, construction' },
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
Villa R+2,150000000,XAF,Villa spacieuse avec piscine et jardin,300,6,4,Avenue Kennedy,Bonapriso,Douala,4.0604°N 9.7135°E`,

    immobilier_terrain: `Nom,Prix,Devise,Description,Superficie,Adresse,Quartier,Ville,GPS
Terrain 500m²,25000000,XAF,Terrain viabilisé prêt à construire,500,Zone industrielle,Logpom,Douala,4.0881°N 9.7043°E
Parcelle 1000m²,45000000,XAF,Terrain constructible bien situé,1000,Rue des Cocotiers,Akwa,Douala,4.0490°N 9.6976°E`,

    automobile: `Nom,Prix,Devise,Description,Marque,Modèle,Année,Kilométrage,Couleur,Carburant,Transmission
Toyota Corolla,8500000,XAF,Voiture en excellent état avec révision complète,Toyota,Corolla,2018,65000,Blanche,Essence,Automatique
Honda Civic,7500000,XAF,Véhicule bien entretenu avec historique complet,Honda,Civic,2017,75000,Grise,Essence,Manuelle`,

    ticket_voyage: `Nom,Prix,Devise,Description,Départ,Destination,Date,Heure,Place,Compagnie
Douala-Yaoundé,3500,XAF,Trajet direct avec arrêt climatisation,Douala,Yaoundé,2024-01-15,08:00,A12,Touristique Express
Yaoundé-Bafoussam,5000,XAF,Bus VIP grand confort avec collation,Yaoundé,Bafoussam,2024-01-16,14:00,B05,Central Voyages`,

    covoiturage: `Nom,Prix,Devise,Description,Départ,Arrivée,Date,Heure,Places disponibles
Trajet Douala-Yaoundé,2500,XAF,Voiture confortable et sécurisée avec climatisation,Bonanjo,Centre-ville Yaoundé,2024-01-15,06:00,3
Trajet Yaoundé-Bafoussam,3500,XAF,SUV climatisé spacieux avec bagages,Yaoundé,Bafoussam,2024-01-16,10:00,4`,

    vetement: `Nom,Prix,Devise,Description,Taille,Couleur,Matière,Marque
T-shirt casual,5000,XAF,T-shirt confortable pour usage quotidien,L,Bleu,Coton,Nike
Robe élégante,25000,XAF,Robe de soirée élégante et raffinée,M,Rouge,Soie,Zara`,

    chaussure: `Nom,Prix,Devise,Description,Pointure,Couleur,Marque
Baskets sport,35000,XAF,Chaussures de running haute performance,42,Noire,Adidas
Sandales,15000,XAF,Sandales d'été confortables et légères,38,Marron,Clarks`,

    electromenager: `Nom,Prix,Devise,Description,Marque,Modèle,État,Garantie
Réfrigérateur,250000,XAF,Grand réfrigérateur double porte avec congélateur,Samsung,RT50,Neuf,2 ans
Micro-ondes,45000,XAF,Micro-ondes 800W avec grill et minuteur,LG,MS2535,Occasion,6 mois`,

    mobilier: `Nom,Prix,Devise,Description,Type,Matériau,Dimensions,Couleur,État
Canapé 3 places,85000,XAF,Canapé confortable avec coussins moelleux,Salon,Tissu,200x90x85,Gris,Neuf
Table à manger,65000,XAF,Table élégante pour 6 personnes,Salle à manger,Bois massif,180x90x75,Marron,Bon état
Bureau moderne,45000,XAF,Bureau spacieux avec tiroirs de rangement,Bureau,Bois/Métal,120x60x75,Blanc,Neuf`,

    aliments: `Nom,Prix,Devise,Description,Catégorie,Origine,Date expiration,Poids/Quantité,Conservation,Certification
Tomates fraîches,500,XAF,Tomates rouges mûres et juteuses du terroir,Légumes,Locale,2024-02-01,1kg,Frais,Bio
Poulet fermier,3500,XAF,Poulet élevé en plein air nourri au grain,Viande,Locale,2024-01-25,1.5kg,Frais,Halal
Mangues Kent,1500,XAF,Mangues sucrées et parfumées de saison,Fruits,Locale,2024-02-05,2kg,Frais,Bio
Riz parfumé,15000,XAF,Riz basmati de qualité supérieure importé,Céréales,Importée,2025-12-31,25kg,Sec,Standard`,

    livres_fournitures: `Nom,Prix,Devise,Description,Catégorie,Niveau,Matière,Auteur,Éditeur,ISBN,Année édition,État
Mathématiques Terminale C,8500,XAF,Manuel complet avec exercices corrigés et cours détaillés,Livre scolaire,Secondaire,Mathématiques,Collection CIAM,Edicef,978-2-7531-0584-3,2023,Neuf
Cahier grand format,500,XAF,Cahier 200 pages grands carreaux de qualité supérieure,Cahier,Primaire,Tous,N/A,Oxford,N/A,2024,Neuf
Pack stylos BIC,2000,XAF,Lot de 10 stylos à bille bleus et noirs longue durée,Stylos,Tous,Tous,N/A,BIC,N/A,2024,Neuf
Histoire du Cameroun,12000,XAF,Ouvrage de référence sur l'histoire précoloniale à nos jours,Livre,Université,Histoire,Prof. Mveng,Clé,978-2-35191-045-7,2022,Bon état`,

    quincaillerie: `Nom,Prix,Devise,Description,Catégorie,Marque,Référence,Unité,Stock disponible
Marteau menuisier,5000,XAF,Marteau professionnel manche bois robuste et tête acier,Outils,Stanley,STHT0-51309,Pièce,50
Peinture blanche 25L,35000,XAF,Peinture acrylique mat lessivable pour intérieur et extérieur,Peinture,Dulux,25L-BL-MAT,Seau,20
Ciment gris,4500,XAF,Ciment Portland haute résistance qualité premium,Matériaux,Cimencam,CEM-II-42.5,Sac 50kg,100
Perceuse électrique,45000,XAF,Perceuse à percussion 650W avec coffret et accessoires,Outils électriques,Bosch,GSB-13-RE,Pièce,15`,

    prestation_service: `Nom,Prix,Devise
Portfolio Réalisation 1,0,XAF
Portfolio Réalisation 2,0,XAF`,

    pharmacie: `Nom,Prix,Devise,Description,Type,Heures ouverture,Heures fermeture,Jours de garde,Téléphone urgence,Services
Pharmacie Centrale,0,XAF,Pharmacie de garde disponible 24h/24 pour urgences médicales,Garde,00:00,23:59,Lundi-Dimanche,+237 6XX XX XX XX,Garde|Délivrance|Conseil
Pharmacie du Marché,0,XAF,Pharmacie de proximité avec conseil pharmaceutique gratuit,Normale,08:00,20:00,Lundi-Samedi,+237 6XX XX XX XX,Délivrance|Conseil`,

    hopital_clinique: `Nom,Prix,Devise,Description,Type,Spécialités,Médecins disponibles,Horaires consultation,Urgences,RDV en ligne
Hôpital Général,0,XAF,Établissement public avec service d'urgences 24h/24,Hôpital,Chirurgie|Pédiatrie|Cardiologie,Dr. A|Dr. B|Dr. C,08:00-17:00,Oui,Non
Clinique Saint-Joseph,0,XAF,Clinique privée moderne avec prise de rendez-vous en ligne,Clinique,Gynécologie|Ophtalmologie,Dr. D|Dr. E,09:00-18:00,Oui,Oui`,

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

    const devises = ['XAF', 'EUR', 'USD', 'GBP'];

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

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const base64Images = result.assets.map(asset =>
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

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsMultipleSelection: true,
                quality: 0.7
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const videoUris = result.assets.map(asset => asset.uri);

                // Convertir les vidéos en base64 (limiter la taille)
                const base64Videos = await Promise.all(
                    videoUris.map(async (uri) => {
                        try {
                            const base64 = await FileSystem.readAsStringAsync(uri, {
                                encoding: FileSystem.EncodingType.Base64
                            });
                            return `data:video/mp4;base64,${base64}`;
                        } catch (err) {
                            console.error('Erreur conversion vidéo:', err);
                            return null;
                        }
                    })
                );

                const validVideos = base64Videos.filter(v => v !== null) as string[];

                setNewProduct({
                    ...newProduct,
                    videos: [...(newProduct.videos || []), ...validVideos]
                });
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
                                marqueElectro: columns[4],
                                modeleElectro: columns[5],
                                etat: columns[6],
                                garantie: columns[7]
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
                                specialites: columns[5]?.split('|').map(s => s.trim()).filter(s => s),
                                medecinsDisponibles: columns[6],
                                horairesConsultation: columns[7],
                                urgencesDisponible: columns[8]?.toLowerCase() === 'oui',
                                rdvEnLigne: columns[9]?.toLowerCase() === 'oui'
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
        if (!newProduct.nom?.trim() || !newProduct.prix?.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir le nom et le prix du produit');
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
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Superficie (m²)</Text>
                            <NativeInput
                                placeholder="Ex: 120"
                                value={newProduct.superficie || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, superficie: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Nombre de chambres</Text>
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
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Adresse</Text>
                            <NativeInput
                                placeholder="Ex: Rue des Jardins"
                                value={newProduct.adresse || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, adresse: text })}
                                style={styles.fieldInput}
                            />
                        </View>
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
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Marque</Text>
                                <NativeInput
                                    placeholder="Ex: Toyota"
                                    value={newProduct.marque || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, marque: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Modèle</Text>
                                <NativeInput
                                    placeholder="Ex: Corolla"
                                    value={newProduct.modele || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modele: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Année</Text>
                                <NativeInput
                                    placeholder="Ex: 2018"
                                    value={newProduct.annee || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, annee: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Kilométrage</Text>
                                <NativeInput
                                    placeholder="Ex: 65000"
                                    value={newProduct.kilometrage || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, kilometrage: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Couleur</Text>
                            <NativeInput
                                placeholder="Ex: Blanche"
                                value={newProduct.couleur || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, couleur: text })}
                                style={styles.fieldInput}
                            />
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Type de carburant</Text>
                                <NativeInput
                                    placeholder="Ex: Essence"
                                    value={newProduct.typeCarburant || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, typeCarburant: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Transmission</Text>
                                <NativeInput
                                    placeholder="Ex: Automatique"
                                    value={newProduct.transmission || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, transmission: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                    </>
                );

            case 'ticket_voyage':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Départ</Text>
                                <NativeInput
                                    placeholder="Ex: Douala"
                                    value={newProduct.depart || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, depart: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Destination</Text>
                                <NativeInput
                                    placeholder="Ex: Yaoundé"
                                    value={newProduct.destination || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, destination: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Date de départ</Text>
                                <NativeInput
                                    placeholder="JJ/MM/AAAA"
                                    value={newProduct.dateDepart || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dateDepart: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Heure</Text>
                                <NativeInput
                                    placeholder="HH:MM"
                                    value={newProduct.heureDepart || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, heureDepart: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
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
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Compagnie</Text>
                            <NativeInput
                                placeholder="Ex: Central Voyages"
                                value={newProduct.compagnieTransport || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, compagnieTransport: text })}
                                style={styles.fieldInput}
                            />
                        </View>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Utilisez le sélecteur de place pour choisir visuellement une place dans le bus
                            </Text>
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
                                    placeholder="Ex: RT50"
                                    value={newProduct.modeleElectro || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleElectro: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>État</Text>
                                <NativeInput
                                    placeholder="Ex: Neuf"
                                    value={newProduct.etat || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, etat: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Garantie</Text>
                                <NativeInput
                                    placeholder="Ex: 2 ans"
                                    value={newProduct.garantie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, garantie: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
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
                                {['Outils', 'Matériaux', 'Peinture', 'Outils électriques', 'Plomberie', 'Électricité'].map((cat) => (
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
                                    value={newProduct.reference || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, reference: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Unité</Text>
                                <View style={styles.pickerButtons}>
                                    {['Pièce', 'Sac', 'Seau', 'Litre', 'm²', 'Lot'].map((unite) => (
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
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Prix de cette réalisation (optionnel)</Text>
                            <NativeInput
                                placeholder="Ex: 50000"
                                value={newProduct.prix || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, prix: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                            <Text style={styles.hintText}>
                                Laissez vide (0) si vous préférez ne pas afficher de prix
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
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de pharmacie</Text>
                            <View style={styles.pickerButtons}>
                                {['Garde', 'Normale'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typePharmacie === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typePharmacie: type })}
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
                        {newProduct.typePharmacie === 'Garde' && (
                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Jours de garde</Text>
                                <NativeInput
                                    placeholder="Ex: Lundi, Mercredi, Vendredi"
                                    value={newProduct.joursGarde || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, joursGarde: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        )}
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
                                placeholder="Ex: Garde, Délivrance, Conseil pharmaceutique"
                                value={newProduct.services || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, services: text })}
                                multiline
                                style={[styles.fieldInput, styles.textareaInput]}
                            />
                        </View>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Les pharmacies de garde sont disponibles 24h/24 pour les urgences
                            </Text>
                        </View>
                    </>
                );

            case 'hopital_clinique':
                return (
                    <>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type d'établissement</Text>
                            <View style={styles.pickerButtons}>
                                {['Hôpital', 'Clinique', 'Centre de santé'].map((type) => (
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
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Spécialités médicales</Text>
                            <NativeInput
                                placeholder="Ex: Chirurgie, Pédiatrie, Cardiologie (séparés par des virgules)"
                                value={newProduct.specialites?.join(', ') || ''}
                                onChangeText={(text) => setNewProduct({
                                    ...newProduct,
                                    specialites: text.split(',').map(s => s.trim()).filter(s => s)
                                })}
                                multiline
                                style={[styles.fieldInput, styles.textareaInput]}
                            />
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Médecins disponibles</Text>
                            <NativeInput
                                placeholder="Ex: Dr. Dupont, Dr. Martin, Dr. Nguema"
                                value={newProduct.medecinsDisponibles || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, medecinsDisponibles: text })}
                                multiline
                                style={[styles.fieldInput, styles.textareaInput]}
                            />
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Horaires de consultation</Text>
                            <NativeInput
                                placeholder="Ex: Lundi-Vendredi 08:00-17:00, Samedi 09:00-13:00"
                                value={newProduct.horairesConsultation || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, horairesConsultation: text })}
                                multiline
                                style={[styles.fieldInput, styles.textareaInput]}
                            />
                        </View>
                        <View style={styles.fieldContainer}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, urgencesDisponible: !newProduct.urgencesDisponible })}
                            >
                                <View style={[
                                    styles.checkbox,
                                    newProduct.urgencesDisponible && styles.checkboxChecked
                                ]}>
                                    {newProduct.urgencesDisponible && (
                                        <SafeIcon name="check" size={16} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>Service des urgences disponible 24h/24</Text>
                            </TouchableOpacity>
                        </View>
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
                                <Text style={styles.checkboxLabel}>Prise de rendez-vous en ligne disponible</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez les spécialités et horaires pour aider les patients à trouver le bon service
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
                                    {PRODUCT_TYPES
                                        .filter(type =>
                                            searchQuery.length === 0 ||
                                            type.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            type.description.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map((type) => (
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

                                {/* Champs communs - Cachés pour Prestation de Service */}
                                {selectedType !== 'prestation_service' && (
                                    <>
                                        <View style={styles.fieldContainer}>
                                            <Text style={styles.fieldLabel}>
                                                Nom du produit <Text style={styles.required}>*</Text>
                                            </Text>
                                            <NativeInput
                                                placeholder="Ex: Appartement F4"
                                                value={newProduct.nom || ''}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, nom: text })}
                                                style={styles.fieldInput}
                                            />
                                        </View>

                                        <View style={styles.fieldContainer}>
                                            <Text style={styles.fieldLabel}>Description</Text>
                                            <NativeInput
                                                placeholder="Décrivez ce produit..."
                                                value={newProduct.description || ''}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
                                                multiline
                                                style={[styles.fieldInput, styles.textareaInput]}
                                            />
                                        </View>
                                    </>
                                )}

                                <View style={styles.fieldRow}>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>
                                            Prix {selectedType !== 'prestation_service' && <Text style={styles.required}>*</Text>}
                                        </Text>
                                        <NativeInput
                                            placeholder={selectedType === 'prestation_service' ? 'Prix (optionnel)' : '0'}
                                            value={newProduct.prix || ''}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, prix: text })}
                                            style={styles.fieldInput}
                                            keyboardType="numeric"
                                        />
                                    </View>

                                    <View style={[styles.fieldContainer, { width: 100 }]}>
                                        <Text style={styles.fieldLabel}>Devise</Text>
                                        <View style={styles.pickerContainer}>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                {devises.map((devise) => (
                                                    <TouchableOpacity
                                                        key={devise}
                                                        style={[
                                                            styles.deviseButton,
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
                                            </ScrollView>
                                        </View>
                                    </View>
                                </View>

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

            {/* Modal GPS pour immobilier */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={(coordinatesString) => {
                    const firstPoint = coordinatesString.split('|')[0].split(',');
                    if (firstPoint.length === 2) {
                        const lat = parseFloat(firstPoint[0]);
                        const lng = parseFloat(firstPoint[1]);
                        setSelectedGPSLocation({ lat, lng });
                        setNewProduct({ ...newProduct, gpsImmobilier: coordinatesString });
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
});

export default ProductManagerMobile;
