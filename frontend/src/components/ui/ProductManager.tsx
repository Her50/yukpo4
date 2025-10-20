import { Badge } from '@/components/ui/badge';
import BusSeatSelector from '@/components/ui/BusSeatSelector';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MapModal from '@/components/ui/MapModal';
import { useToast } from '@/components/ui/use-toast';
import { Check, ChevronDown, Download, Edit2, FileText, MapPin, Plus, Trash2, Upload, Video, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

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
    { value: 'aliments', label: 'Aliments et Produits Frais', icon: '🍎', description: 'Fruits, légumes, viandes, poissons, produits frais et secs' },
    { value: 'automobile', label: 'Automobiles et Véhicules', icon: '🚗', description: 'Voitures, motos, camions, véhicules utilitaires' },
    { value: 'chaussure', label: 'Chaussures et Accessoires', icon: '👟', description: 'Chaussures, baskets, sandales, bottes' },
    { value: 'covoiturage', label: 'Covoiturage et Trajets', icon: '🚙', description: 'Trajets partagés, carpooling, transport collectif' },
    { value: 'decoration', label: 'Décoration Intérieure', icon: '🖼️', description: 'Tableaux, luminaires, tapis, accessoires déco' },
    { value: 'electromenager', label: 'Électroménager Domestique', icon: '🔌', description: 'Frigos, fours, machines à laver, micro-ondes' },
    { value: 'hopital_clinique', label: 'Établissements de Santé', icon: '🏥', description: 'Hôpitaux, cliniques, centres médicaux, spécialités' },
    { value: 'image_son', label: 'Image et Son', icon: '📺', description: 'TV, home cinéma, enceintes, projecteurs, systèmes audio' },
    { value: 'immobilier_batiment', label: 'Immobilier - Bâtiments', icon: '🏢', description: 'Appartements, villas, maisons, immeubles' },
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
Article standard,50,USD,Description complète de l'article`
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

        // ✅ Vérifier les limites AVANT traitement
        const currentCount = editingProduct[type]?.length || 0;
        const maxImages = 5; // Max 5 images par produit
        const maxVideos = 1; // Max 1 vidéo par produit
        const maxItems = type === 'images' ? maxImages : maxVideos;

        if (currentCount >= maxItems) {
            toast({
                title: "Limite atteinte",
                description: `Maximum ${maxItems} ${type === 'images' ? 'images' : 'vidéo'} par produit pour éviter l'erreur 413`,
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
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">🛍️ Produits</h3>
                    <p className="text-sm text-gray-600">Gérez les produits de votre service</p>
                </div>
                {!readonly && (
                    <Button onClick={handleAddProduct} size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter un produit
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                        <CardContent className="space-y-6">
                            {/* Étape 1: Sélection du type */}
                            {currentStep === 'type' && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">✨ Sélectionnez le type de produit <span className="text-red-600">*</span></h3>
                                    <p className="text-sm text-gray-600">Choisissez la catégorie qui correspond le mieux à votre produit</p>

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
                                        {PRODUCT_TYPES
                                            .filter(type => {
                                                if (searchQuery.length === 0) return true;
                                                const query = searchQuery.toLowerCase();
                                                return type.label.toLowerCase().includes(query) ||
                                                    type.description.toLowerCase().includes(query) ||
                                                    ((type as any).keywords && (type as any).keywords.some((kw: string) => kw.toLowerCase().includes(query)));
                                            })
                                            .map((type) => (
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
                                                <div>
                                                    <Label htmlFor="product-price">Prix *</Label>
                                                    <Input
                                                        id="product-price"
                                                        type="number"
                                                        value={editingProduct.price}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            price: e.target.value
                                                        }))}
                                                        placeholder="0"
                                                    />
                                                </div>
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

                                    {/* Sélection de devise */}
                                    <div>
                                        <Label>Devise</Label>
                                        <div className="relative">
                                            <Button
                                                variant="outline"
                                                className="w-full justify-between"
                                                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                                            >
                                                {CURRENCIES.find(c => c.code === editingProduct.currency)?.name || 'Sélectionner une devise'}
                                                <ChevronDown className="w-4 h-4" />
                                            </Button>
                                            {showCurrencyDropdown && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                    {CURRENCIES.map((currency) => (
                                                        <button
                                                            key={currency.code}
                                                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                                                            onClick={() => {
                                                                setEditingProduct(prev => ({
                                                                    ...prev!,
                                                                    currency: currency.code
                                                                }));
                                                                setShowCurrencyDropdown(false);
                                                            }}
                                                        >
                                                            <div>
                                                                <div className="font-medium">{currency.code}</div>
                                                                <div className="text-sm text-gray-600">{currency.name}</div>
                                                            </div>
                                                            <div className="text-sm text-gray-500">{currency.symbol}</div>
                                                        </button>
                                                    ))}
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

                                    {/* Actions */}
                                    <div className="flex justify-end gap-2 pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setEditingProduct(null);
                                                setCurrentStep('type');
                                            }}
                                        >
                                            Annuler
                                        </Button>
                                        <Button onClick={handleSaveProduct}>
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

















