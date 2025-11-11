// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
// Code corrigé (remplace @ts-ignore)
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
// Code corrigé (remplace @ts-ignore)
// ✅ NOUVEAU 2025-11-02: Gestionnaire upload images/vidéos dédié
import BrandingManagerMobile from '../components/BrandingManagerMobile';
import MediaUploadManager from '../components/MediaUploadManager';
// Code corrigé (remplace @ts-ignore)
import ModernGPSModal from '../components/ModernGPSModal';
// Code corrigé (remplace @ts-ignore)
import PaymentMethodSelector from '../components/PaymentMethodSelector';
// Code corrigé (remplace @ts-ignore)
import { NativeButton, NativeCard, NativeDivider, NativeInput } from '../components/NativeDesign';
import NavigatorToolbar from '../components/NavigatorToolbar';
// ✅ SUPPRIMÉ: ProductManagerMobile intégré directement dans le formulaire
import LinearAutocompleteEditor from '../components/LinearAutocompleteEditor';
import LocationSelector from '../components/LocationSelector';
import PriceVariantSelector from '../components/PriceVariantSelector';
// ✅ AJOUT: Composants pour modalités personnalisées et sélection multiple
import ProductFieldSelector from '../components/ProductFieldSelector';
import { applyPriceVariantToProduits, extractPriceVariant } from '../utils/priceVariant';
import { getSuggestedProductCategories } from '../utils/suggestProductCategories';
// Code corrigé (remplace @ts-ignore)
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
// TODO: Fix TypeScript type issue
// Code corrigé (remplace @ts-ignore)
import { modernColors } from '../theme/modernTheme';
import { DynamicField, processIASuggestion } from '../utils/formDispatcher';
import { MAX_PRODUCT_IMAGES, mergeImageSources, orderImagesWithPrimary } from '../utils/mediaHelpers';

const { width } = Dimensions.get('window');
const TAB_WIDTH = 136;

interface ServiceData {
  serviceId?: string;
  cout?: number;
}

interface MediaFiles {
  images: any[];
  audios: any[];
  videos: any[];
  documents: any[];
  excel: any[];
  logo: any[];
  banner: any[];
}

const PRODUCT_BLOCK_FIELD_NAMES = [
  'nom_produit',
  'categorie_produit',
  'description_produit',
  'produits',
  'product_labels',
  'prix',
  'prix_produit',
  'devise',
  'devise_produit',
  'price_variant',
  'variabilite_prix',
  'variation_prix',
  'lieu_produit',
  'lieu_commercial',
  'lieu_commercialisation',
  '_product_media_manager',
  'images',
  'videos',
  'audios',
  'documents'
];

const FormulaireYukpoIntelligentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, logout } = useAuth();
  const blockNavigationRef = React.useRef(null);
  const blockContentRef = React.useRef(null);

  const params = ((route || {})?.params || {}) as any;

  const {
    suggestion: suggestionParam = {},
    mediaData: mediaDataParam = {},
    gpsData: gpsDataParam = {},
    type: typeParam = '',
    mode: modeParam = 'create',
    serviceId,
    fromMesServices = false,
    fromMesProduits = false,
    readonly: readonlyParam = false,
    focusBlock,
    focusProductId,
    duplicateProduct,
    editProductData,
    isAddingProductToExistingService: routeAddProductFlag = false
  } = params;

  // État des données reçues
  const suggestion = suggestionParam || {};
  const mediaData = mediaDataParam || {};
  const gpsData = gpsDataParam || {};
  const type = typeParam || '';
  const mode = modeParam || 'create'; // ✅ Par défaut 'create' au lieu de 'edit'

  // ✅ Déterminer si on est en mode lecture seule
  const isReadonly = mode === 'readonly' || mode === 'view' || readonlyParam;

  // ✅ Déterminer si on duplique un produit existant
  const isAddingProduct = !!duplicateProduct && !!serviceId;

  const explicitAddProductFlag = Boolean(routeAddProductFlag);
  const isAddingProductToExistingService = explicitAddProductFlag || mode === 'add_product' || isAddingProduct;

  // ✅ NOUVEAU 2025-11-06: Mode édition des infos du service (sans toucher aux produits)
  const isEditingServiceInfo = mode === 'edit_service_info' && serviceId;

  // États locaux
  const [activeStep, setActiveStep] = useState(1);
  const [composants, setComposants] = useState<DynamicField[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ NOUVEAU: Protection contre double soumission
  const [valeursFormulaire, setValeursFormulaire] = useState<Record<string, any>>({});
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  // ✅ SUPPRIMÉ: Duplication produits - Les produits sont maintenant gérés via les champs dynamiques
  const normalizeMediaList = (value: any): any[] => {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter((item) => item !== null && item !== undefined);
    }

    return [value];
  };

  const extractMediaValues = (...sources: any[]): any[] => {
    for (const source of sources) {
      if (!source) {
        continue;
      }

      const candidate = typeof source === 'object' && source !== null && 'valeur' in source
        ? (source as any).valeur
        : source;

      const normalized = normalizeMediaList(candidate);
      if (normalized.length > 0) {
        return normalized;
      }
    }

    return [];
  };

  const arraysEqual = (a: any[], b: any[]): boolean => {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => value === b[index]);
  };

  const initialProductImages = mergeImageSources(
    MAX_PRODUCT_IMAGES,
    mediaData?.base64_image,
    mediaData?.image_base64,
    suggestion?.data?.base64_image,
    suggestion?.service_data?.base64_image,
    suggestion?.base64_image
  );

  const initialLogo = extractMediaValues(
    mediaData?.logo,
    mediaData?.logo_base64,
    mediaData?.branding_logo,
    suggestion?.data?.logo,
    suggestion?.data?.logo?.valeur,
    suggestion?.service_data?.logo,
    suggestion?.service_data?.data?.logo,
    suggestion?.service_data?.data?.logo?.valeur
  );

  const initialBanner = extractMediaValues(
    mediaData?.banner,
    mediaData?.banniere,
    mediaData?.banner_base64,
    suggestion?.data?.banner,
    suggestion?.data?.banner?.valeur,
    suggestion?.data?.banniere,
    suggestion?.data?.banniere?.valeur,
    suggestion?.service_data?.banner,
    suggestion?.service_data?.data?.banner,
    suggestion?.service_data?.data?.banniere,
    suggestion?.service_data?.data?.banner?.valeur,
    suggestion?.service_data?.data?.banniere?.valeur
  );

  const initialMediaState: MediaFiles = {
    images: initialProductImages,
    audios: normalizeMediaList(mediaData?.audio_base64),
    videos: normalizeMediaList(mediaData?.video_base64),
    documents: normalizeMediaList(mediaData?.doc_base64),
    excel: normalizeMediaList(mediaData?.excel_base64),
    logo: initialLogo,
    banner: initialBanner
  };

  const [mediaFiles, setMediaFiles] = useState<MediaFiles>(initialMediaState);
  const [primaryProductImage, setPrimaryProductImage] = useState<string | null>(initialMediaState.images[0] || null);
  const [gps, setGps] = useState<string | undefined>(undefined);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successData, setSuccessData] = useState<ServiceData | null>(null);
  // ✅ SUPPRIMÉ: products et setProducts - Les produits sont maintenant gérés via les champs dynamiques (autocomplete, price_variant)
  const [paymentMethod, setPaymentMethod] = useState<any>(null); // ✅ NOUVEAU: Mode de paiement

  // États pour la navigation par blocs
  const [currentBlock, setCurrentBlock] = useState(0);
  const [blocks, setBlocks] = useState<{
    id: string;
    title: string;
    icon: string;
    fields: DynamicField[];
  }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dynamicTextareaHeights, setDynamicTextareaHeights] = useState<Record<string, number>>({});
  const [blockHorizontalScrollEnabled, setBlockHorizontalScrollEnabled] = useState(true);

  const formatMultilineValue = React.useCallback((rawValue: any): string => {
    if (typeof rawValue !== 'string') {
      return '';
    }
    return rawValue
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\\n/g, '\n');
  }, []);
  const handleMediaHorizontalScrollStart = useCallback(() => {
    setBlockHorizontalScrollEnabled(false);
  }, []);

  const handleMediaHorizontalScrollEnd = useCallback(() => {
    setBlockHorizontalScrollEnabled(true);
  }, []);

  const displayedBlocks = useMemo(() => {
    if (!blocks || blocks.length === 0) {
      return [];
    }

    return blocks.reduce((acc: any[], block, index) => {
      if (isEditingServiceInfo && block.id === 'products') {
        return acc;
      }

      acc.push({ block, index });
      return acc;
    }, []);
  }, [blocks, isEditingServiceInfo]);

  const currentDisplayIndex = useMemo(() => {
    if (!displayedBlocks || displayedBlocks.length === 0) {
      return 0;
    }

    const index = displayedBlocks.findIndex((item) => item.index === currentBlock);
    return index === -1 ? 0 : index;
  }, [displayedBlocks, currentBlock]);

  const totalVisibleBlocks = displayedBlocks.length;
  const progressPercentage = totalVisibleBlocks > 0
    ? ((currentDisplayIndex + 1) / totalVisibleBlocks) * 100
    : 0;

  useEffect(() => {
    if (!displayedBlocks || displayedBlocks.length === 0) {
      return;
    }

    const isCurrentVisible = displayedBlocks.some((item) => item.index === currentBlock);

    if (!isCurrentVisible) {
      setCurrentBlock(displayedBlocks[0].index);
      if (blockContentRef.current && typeof blockContentRef.current.scrollTo === 'function') {
        blockContentRef.current.scrollTo({ x: 0, y: 0, animated: true });
      }
    }
  }, [displayedBlocks, currentBlock]);

  useEffect(() => {
    const displayIndex = displayedBlocks.findIndex((item) => item.index === currentBlock);
    if (displayIndex === -1) {
      return;
    }

    const targetOffset = Math.max(0, displayIndex * TAB_WIDTH - TAB_WIDTH);
    if (blockNavigationRef.current && typeof blockNavigationRef.current.scrollTo === 'function') {
      blockNavigationRef.current.scrollTo({ x: targetOffset, y: 0, animated: true });
    }
  }, [currentBlock, displayedBlocks]);

  useEffect(() => {
    const parseMediaValue = (value: any): any[] => {
      if (!value) {
        return [];
      }

      if (typeof value === 'object' && value !== null && 'valeur' in value) {
        return normalizeMediaList((value as any).valeur);
      }

      return normalizeMediaList(value);
    };

    const nextLogo = parseMediaValue(valeursFormulaire.logo ?? valeursFormulaire.logo_service);
    const nextBanner = parseMediaValue(valeursFormulaire.banner ?? valeursFormulaire.banniere);

    setMediaFiles((prev) => {
      const logoChanged = !arraysEqual(prev.logo, nextLogo);
      const bannerChanged = !arraysEqual(prev.banner, nextBanner);

      if (!logoChanged && !bannerChanged) {
        return prev;
      }

      return {
        ...prev,
        logo: logoChanged ? nextLogo : prev.logo,
        banner: bannerChanged ? nextBanner : prev.banner
      };
    });
  }, [valeursFormulaire.logo, valeursFormulaire.logo_service, valeursFormulaire.banner, valeursFormulaire.banniere]);

  // Fonction de gestion du retour
  const handleGoBack = () => {
    // ✅ Si on est au premier bloc, retourner à l'écran précédent
    if (currentDisplayIndex === 0) {
      if (fromMesServices) {
        try {
          (navigation as any).navigate('Main', { screen: 'Services' });
        } catch (error) {
          console.error('Erreur navigation retour MesServices:', error);
          navigation.goBack();
        }
      } else {
        navigation.goBack();
      }
    } else {
      // ✅ Sinon, revenir au bloc précédent
      goToPreviousBlock();
    }
  };

  // Fonction pour organiser les champs en blocs (alignée sur le frontend)
  const organizeFieldsIntoBlocks = (fields: DynamicField[], formValues: Record<string, any> = {}) => {
    const blocks = [
      {
        id: 'general',
        title: 'Informations générales',
        icon: '📋',
        fields: [] as DynamicField[]
      },
      {
        id: 'contact',
        title: 'Contact',
        icon: '📞',
        fields: [] as DynamicField[]
      },
      {
        id: 'location',
        title: 'Localisation',
        icon: '📍',
        fields: [] as DynamicField[]
      },
      {
        id: 'products',
        title: 'Produits / Prestations',
        icon: '🛍️',
        fields: [] as DynamicField[]
      },
      {
        id: 'media',
        title: 'Identité Visuelle',
        icon: '🎨',
        fields: [] as DynamicField[]
      },
      {
        id: 'payment',
        title: 'Paiement',
        icon: '💳',
        fields: [] as DynamicField[]
      },
      {
        id: 'other',
        title: 'Autres informations',
        icon: 'ℹ️',
        fields: [] as DynamicField[]
      }
    ];

    fields.forEach(field => {
      const fieldName = field.name.toLowerCase();

      // Bloc Informations générales
      if (['titre_service', 'category', 'description', 'is_tarissable', 'vitesse_tarissement', 'prix', 'devise'].includes(fieldName)) {
        blocks[0].fields.push(field);
      }
      // Bloc Contact
      else if (['whatsapp', 'telephone', 'email', 'website', 'adresse', 'horaires'].includes(fieldName)) {
        blocks[1].fields.push(field);
      }
      // Bloc Localisation (✅ NOUVEAU 2025-11-06: lieu_produit déplacé vers bloc Produits)
      else if (['gps_fixe', 'zone_intervention', 'localisation', 'pays', 'ville', 'quartier'].includes(fieldName)) {
        blocks[2].fields.push(field);
      }
      // Bloc Produits
      // ✅ NOUVEAU 2025-11-06: Inclure lieu_produit, images, videos dans le bloc produits
      // ✅ CORRECTION: Ne plus dépendre de la présence d'un champ produits de l'IA
      // Le bloc produits sera toujours présent avec un champ par défaut (voir plus bas)
      // ✅ AJOUT: price_variant (variabilite_prix) va aussi dans le bloc produits
      // ✅ IMPORTANT: Les champs spécifiques au produit (nom_produit, categorie_produit, description_produit, prix_produit, devise_produit)
      //    vont dans le bloc Produits, PAS dans Informations générales (qui contient titre_service, category, description)
      // ✅ CORRECTION CRITIQUE: Détecter aussi les champs par leur typeDonnee (autocomplete, price_variant)
      else if (
        ['liste_produits', 'produits', 'listeproduit', 'variabilite_prix', 'price_variant',
          'nom_produit', 'categorie_produit', 'description_produit', 'prix_produit', 'devise_produit',
          'lieu_produit', 'lieu_commercial', 'lieu_commercialisation', // ✅ NOUVEAU: Lieu dans produits
          'prix', 'devise', // ✅ Prix et devise dans produits
          'images', 'videos' // ✅ NOUVEAU: Médias dans produits
        ].includes(fieldName) ||
        field.typeDonnee === 'price_variant' ||
        field.typeDonnee === 'autocomplete'
      ) {
        blocks[3].fields.push(field);
        console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ ajouté au bloc produits/prestations: ${field.name} (typeDonnee: ${field.typeDonnee})`);
      }
      // Bloc Médias (✅ NOUVEAU 2025-11-06: images/videos déplacées vers bloc Produits, ne garder que audios/documents)
      else if (['audios', 'documents'].includes(fieldName)) {
        blocks[4].fields.push(field);
      }
      // Bloc Paiement
      else if (['mode_paiement', 'paiement', 'payment'].includes(fieldName)) {
        blocks[5].fields.push(field);
      }
      // Autres
      else {
        blocks[6].fields.push(field);
      }
    });

    // ✅ NOUVEAU 2025-11-06: Fonction de tri pour l'ordre des champs du bloc Produits
    const sortProductFields = (fields: DynamicField[]): DynamicField[] => {
      const fieldOrder = [
        'nom_produit', // 1. Nom du produit
        'categorie_produit', // 2. Catégorie
        'description_produit', // 3. Description
        'produits', // 4. Caractéristiques (autocomplete)
        'lieu_produit', 'lieu_commercial', 'lieu_commercialisation', // 5. Lieu
        'prix', 'prix_produit', // 6. Prix
        'devise', 'devise_produit', // 7. Devise (sera affichée inline avec prix)
        'price_variant', 'variabilite_prix', // 8. Variations prix
        'images', 'videos', '_product_media_manager' // 9. Médias
      ];

      return fields.sort((a, b) => {
        const indexA = fieldOrder.indexOf(a.name);
        const indexB = fieldOrder.indexOf(b.name);

        // Si le champ n'est pas dans fieldOrder, le mettre à la fin
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;

        return indexA - indexB;
      });
    };

    // Ajouter les blocs fixes (produits, médias) même s'ils n'ont pas de champs dynamiques
    // Car ils utilisent des composants spécialisés
    const blocksWithFixedOnes = [...blocks];

    // ✅ CORRECTION: Le bloc produits doit TOUJOURS être présent, indépendamment de ce que génère l'IA
    // Car l'IA ne génère le champ produits que dans certains cas (tableaux, plusieurs produits visibles)
    // Mais TOUS les services peuvent contenir des produits/prestations
    const productsBlock = blocksWithFixedOnes.find(b => b.id === 'products');

    // ✅ RÈGLE ABSOLUE: Toujours créer/garantir le bloc produits avec autocomplete + champs spécifiques produits
    if (!productsBlock) {
      // Si le bloc n'existe pas du tout, le créer avec les champs par défaut
      // ✅ NOUVEAU: Label dynamique selon type_offre de l'IA
      const typeOffre = formValues.type_offre || formValues.nature_offre || 'produit';
      const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';

      const defaultProductsFields: DynamicField[] = [
        {
          name: 'nom_produit',
          type: 'text',
          typeDonnee: 'string',
          label: 'Nom du produit / prestation',
          multiline: true,
          minLines: 1,
          required: false,
          placeholder: isPrestation
            ? 'Ex: Cours de maths niveau terminal, Réparation écran téléphone...'
            : 'Ex: iPhone 14 Pro Max 256GB, Toyota RAV4 2018 4x4...'
        },
        {
          name: 'categorie_produit',
          type: 'text',
          typeDonnee: 'string',
          label: 'Catégorie du produit / prestation',
          multiline: true,
          minLines: 1,
          required: false,
          placeholder: 'Ex: Smartphone, Cours particulier, Service de réparation...'
        },
        {
          name: 'description_produit',
          type: 'textarea',
          typeDonnee: 'string',
          label: 'Description du produit / prestation',
          required: false,
          placeholder: 'Décrivez les caractéristiques spécifiques du produit...'
        },
        {
          name: 'produits',
          type: 'autocomplete',
          typeDonnee: 'autocomplete',
          label: 'Caractéristiques produits / prestations',
          required: false,
          placeholder: 'Tapez pour voir les suggestions...',
          identifiantBase: 'produits',
          sousCaracteristiques: formValues.produits?.sous_caracteristiques || {
            // Caractéristiques essentielles
            marque: [],
            modele: [],
            couleur: ['Noir', 'Blanc', 'Gris', 'Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Rose', 'Violet'],

            // Caractéristiques secondaires
            annee: ['2024', '2023', '2022', '2021', '2020', '2019', '2018'],
            etat: ['Neuf', 'Comme neuf', 'Bon état', 'Très bon état', 'Occasion', 'À rénover'],
            version: [],

            // Caractéristiques prestations
            competences: [],
            experience: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel'],
            niveau: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel']
          },
          separateur: ',',
          filtrable: true,
          allowCustomModality: true
        },
        {
          name: 'lieu_produit',
          type: 'location',
          typeDonnee: 'location',
          label: 'Lieu de commercialisation',
          required: true,  // ✅ OBLIGATOIRE pour hiérarchie géographique bidirectionnelle
          placeholder: 'Rechercher ville, quartier, pays, région...',
          filtrable: true
        },
        {
          name: '_product_media_manager',
          type: 'custom',
          label: 'Photos et vidéos du produit',
          required: false
        }
      ];

      blocksWithFixedOnes.push({
        id: 'products',
        title: isPrestation ? 'Prestations' : 'Produits',
        icon: isPrestation ? '⚙️' : '🛍️',
        fields: defaultProductsFields
      });
      console.log('[FormulaireYukpoIntelligentScreen] ✅ Bloc produits créé avec champs par défaut:', {
        nbChamps: defaultProductsFields.length,
        champsNoms: defaultProductsFields.map(f => f.name),
        champProduits: defaultProductsFields.find(f => f.name === 'produits')
      });
    } else if (productsBlock.fields.length === 0) {
      // Si le bloc existe mais est vide (IA n'a pas généré de champ produits), ajouter les champs par défaut
      // ✅ NOUVEAU: Label dynamique selon type_offre de l'IA
      const typeOffre = formValues.type_offre || formValues.nature_offre || 'produit';
      const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';

      const defaultProductsFields: DynamicField[] = [
        {
          name: 'nom_produit',
          type: 'text',
          typeDonnee: 'string',
          label: 'Nom du produit / prestation',
          multiline: true,
          minLines: 1,
          required: false,
          placeholder: isPrestation
            ? 'Ex: Cours de maths niveau terminal, Réparation écran téléphone...'
            : 'Ex: iPhone 14 Pro Max 256GB, Toyota RAV4 2018 4x4...'
        },
        {
          name: 'categorie_produit',
          type: 'text',
          typeDonnee: 'string',
          label: 'Catégorie du produit / prestation',
          multiline: true,
          minLines: 1,
          required: false,
          placeholder: 'Ex: Smartphone, Cours particulier, Service de réparation...'
        },
        {
          name: 'description_produit',
          type: 'textarea',
          typeDonnee: 'string',
          label: 'Description du produit / prestation',
          required: false,
          placeholder: 'Décrivez les caractéristiques spécifiques du produit...'
        },
        {
          name: 'produits',
          type: 'autocomplete',
          typeDonnee: 'autocomplete',
          label: 'Caractéristiques produits / prestations',
          required: false,
          placeholder: 'Tapez pour voir les suggestions...',
          identifiantBase: 'produits',
          sousCaracteristiques: formValues.produits?.sous_caracteristiques || {
            // Caractéristiques essentielles
            marque: [],
            modele: [],
            couleur: ['Noir', 'Blanc', 'Gris', 'Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Rose', 'Violet'],

            // Caractéristiques secondaires
            annee: ['2024', '2023', '2022', '2021', '2020', '2019', '2018'],
            etat: ['Neuf', 'Comme neuf', 'Bon état', 'Très bon état', 'Occasion', 'À rénover'],
            version: [],

            // Caractéristiques prestations
            competences: [],
            experience: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel'],
            niveau: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel']
          },
          separateur: ',',
          filtrable: true,
          allowCustomModality: true
        },
        {
          name: 'lieu_produit',
          type: 'location',
          typeDonnee: 'location',
          label: 'Lieu de commercialisation',
          required: true,  // ✅ OBLIGATOIRE pour hiérarchie géographique bidirectionnelle
          placeholder: 'Rechercher ville, quartier, pays, région...',
          filtrable: true
        },
        {
          name: '_product_media_manager',
          type: 'custom',
          label: 'Photos et vidéos du produit',
          required: false
        }
      ];

      productsBlock.fields.push(...defaultProductsFields);
      // ✅ NOUVEAU: Mettre à jour le titre du bloc aussi
      productsBlock.title = isPrestation ? 'Prestations' : 'Produits';
      productsBlock.icon = isPrestation ? '⚙️' : '🛍️';
      console.log('[FormulaireYukpoIntelligentScreen] ✅ Champs par défaut ajoutés au bloc produits existant:', {
        nbChamps: productsBlock.fields.length,
        champsNoms: productsBlock.fields.map(f => f.name),
        champProduits: productsBlock.fields.find(f => f.name === 'produits')
      });
    } else {
      // ✅ Si le bloc existe ET a déjà des champs, vérifier si les champs spécifiques produits existent
      // ✅ NOUVEAU: Vérifier aussi si type_offre existe pour adapter le label
      const hasNomProduit = productsBlock.fields.some(f => f.name === 'nom_produit');
      const hasCategorieProduit = productsBlock.fields.some(f => f.name === 'categorie_produit');
      const hasDescriptionProduit = productsBlock.fields.some(f => f.name === 'description_produit');

      // Ajouter les champs manquants au début du bloc
      const hasPrixProduit = productsBlock.fields.some(f => f.name === 'prix_produit');
      const hasDeviseProduit = productsBlock.fields.some(f => f.name === 'devise_produit');

      if (!hasNomProduit) {
        // ✅ NOUVEAU: Label dynamique selon type_offre de l'IA
        const typeOffre = formValues.type_offre || formValues.nature_offre || 'produit';
        const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';

        productsBlock.fields.unshift({
          name: 'nom_produit',
          type: 'text',
          typeDonnee: 'string',
          label: isPrestation ? 'Nom de la prestation' : 'Nom du produit',
          multiline: true,
          minLines: 1,
          required: false,
          placeholder: isPrestation
            ? 'Ex: Cours de mathématiques, Réparation téléphone, Consultation médicale...'
            : 'Ex: iPhone 14 Pro Max, Toyota RAV4 2018, Nike Air Max...'
        } as DynamicField);
      }
      if (!hasCategorieProduit) {
        productsBlock.fields.splice(hasNomProduit ? 1 : 0, 0, {
          name: 'categorie_produit',
          type: 'text',
          typeDonnee: 'string',
          label: 'Catégorie du produit/prestation',
          multiline: true,
          minLines: 1,
          required: false,
          placeholder: 'Ex: Smartphone, Cours particulier, Service de réparation...'
        } as DynamicField);
      }
      if (!hasDescriptionProduit) {
        productsBlock.fields.splice((hasNomProduit ? 1 : 0) + (hasCategorieProduit ? 1 : 0), 0, {
          name: 'description_produit',
          type: 'textarea',
          typeDonnee: 'string',
          label: 'Description du produit/prestation',
          required: false,
          placeholder: 'Décrivez les caractéristiques spécifiques du produit/prestation...'
        } as DynamicField);
      }

      // ✅ CORRECTION 2025-11-04 : TOUJOURS ajouter le champ produits (caractéristiques) s'il n'existe pas
      const hasProduits = productsBlock.fields.some(f => f.name === 'produits' || f.typeDonnee === 'autocomplete');
      if (!hasProduits) {
        const typeOffre = formValues.type_offre || formValues.nature_offre || 'produit';
        const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';

        productsBlock.fields.push({
          name: 'produits',
          type: 'autocomplete',
          typeDonnee: 'autocomplete',
          label: isPrestation ? 'Caractéristiques prestations' : 'Caractéristiques produits',
          multiline: true,
          minLines: 1,
          required: false,
          placeholder: 'Tapez pour voir les suggestions...',
          identifiantBase: 'produits',
          sousCaracteristiques: formValues.produits?.sous_caracteristiques || {
            // Caractéristiques essentielles
            marque: [],
            modele: [],
            couleur: ['Noir', 'Blanc', 'Gris', 'Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Rose', 'Violet'],
            // Caractéristiques secondaires
            annee: ['2024', '2023', '2022', '2021', '2020', '2019', '2018'],
            etat: ['Neuf', 'Comme neuf', 'Bon état', 'Très bon état', 'Occasion', 'À rénover'],
            version: [],
            // Caractéristiques prestations
            competences: [],
            experience: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel'],
            niveau: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel']
          },
          separateur: ',',
          filtrable: true,
          allowCustomModality: true,
          value: formValues.produits?.valeur || []
        } as DynamicField);
        console.log('[FormulaireYukpoIntelligentScreen] ✅ Champ produits (autocomplete) ajouté automatiquement');
      }

      // ✅ NOUVEAU 2025-11-04: NE PAS ajouter prix_produit/devise_produit si variation_prix existe
      const hasVariationPrix = productsBlock.fields.some(f =>
        f.typeDonnee === 'price_variant' || f.name === 'variabilite_prix' || f.name === 'variation_prix'
      );

      if (!hasPrixProduit && !hasVariationPrix) {
        productsBlock.fields.splice((hasNomProduit ? 1 : 0) + (hasCategorieProduit ? 1 : 0) + (hasDescriptionProduit ? 1 : 0), 0, {
          name: 'prix_produit',
          type: 'number',
          typeDonnee: 'number',
          label: 'Prix du produit/prestation',
          required: false,
          placeholder: 'Ex: 150000',
          value: formValues.prix_produit || ''
        } as DynamicField);
      }
      if (!hasDeviseProduit && !hasVariationPrix) {
        productsBlock.fields.splice((hasNomProduit ? 1 : 0) + (hasCategorieProduit ? 1 : 0) + (hasDescriptionProduit ? 1 : 0) + (hasPrixProduit ? 1 : 0), 0, {
          name: 'devise_produit',
          type: 'select',
          typeDonnee: 'select',
          label: 'Devise',
          required: false,
          placeholder: 'Sélectionnez une devise',
          options: ['XAF', 'EUR', 'USD', 'GBP', 'CAD', 'CHF'],
          value: formValues.devise_produit || 'XAF'
        } as DynamicField);
      }

      // ✅ NOUVEAU: Ajouter le champ lieu_produit après les caractéristiques produit
      const hasLieuProduit = productsBlock.fields.some(f => f.name === 'lieu_produit');
      if (!hasLieuProduit) {
        // Trouver la position après le champ 'produits' (autocomplete) ou après variation_prix s'il existe
        const produitsIndex = productsBlock.fields.findIndex(f => f.name === 'produits' || f.typeDonnee === 'autocomplete');
        const variationPrixIndex = productsBlock.fields.findIndex(f => f.name === 'variabilite_prix' || f.typeDonnee === 'price_variant');
        const insertIndex = variationPrixIndex >= 0 ? variationPrixIndex + 1 : (produitsIndex >= 0 ? produitsIndex + 1 : productsBlock.fields.length);

        productsBlock.fields.splice(insertIndex, 0, {
          name: 'lieu_produit',
          type: 'location',
          typeDonnee: 'location',
          label: 'Lieu de commercialisation',
          required: true,  // ✅ OBLIGATOIRE pour hiérarchie géographique bidirectionnelle
          placeholder: 'Rechercher ville, quartier, pays, région...',
          filtrable: true
        } as DynamicField);
      }

      const hasProductMediaManager = productsBlock.fields.some(f => f.name === '_product_media_manager');
      if (!hasProductMediaManager) {
        productsBlock.fields.push({
          name: '_product_media_manager',
          type: 'custom',
          label: 'Photos et vidéos du produit',
          required: false
        } as DynamicField);
      }
    }

    // S'assurer que le bloc médias contient le gestionnaire d'identité visuelle
    const mediaBlock = blocksWithFixedOnes.find(b => b.id === 'media');
    if (mediaBlock) {
      const hasBrandingManager = mediaBlock.fields.some(
        (f) => f.name === '_media_manager' || f.name === '_branding_manager'
      );

      if (!hasBrandingManager) {
        mediaBlock.fields.unshift({
          name: '_media_manager',
          type: 'custom',
          label: 'Identité visuelle',
          required: false
        } as any);
      }
    }


    // ✅ NOUVEAU: S'assurer que le bloc paiement est toujours présent
    if (!blocksWithFixedOnes.find(b => b.id === 'payment').fields.length) {
      blocksWithFixedOnes.find(b => b.id === 'payment')!.fields.push({
        name: '_payment_manager',
        type: 'custom',
        label: 'Mode de paiement',
        required: false
      } as any);
    }

    // S'assurer que le bloc localisation a toujours un champ GPS fixe
    const locationBlock = blocksWithFixedOnes.find(b => b.id === 'location');
    if (locationBlock && !locationBlock.fields.find(f => f.name === 'gps_fixe')) {
      locationBlock.fields.push({
        name: 'gps_fixe',
        type: 'custom',
        label: 'Position GPS fixe',
        required: false,
        placeholder: 'Sélectionner une position'
      } as any);
    }

    // S'assurer que le bloc contact a toujours les champs de contact minimaux
    const contactBlock = blocksWithFixedOnes.find(b => b.id === 'contact');
    if (contactBlock) {
      // Ajouter les champs de contact s'ils n'existent pas déjà
      const contactFields = ['whatsapp', 'telephone', 'email', 'website'];
      contactFields.forEach(fieldName => {
        if (!contactBlock.fields.find(f => f.name === fieldName)) {
          contactBlock.fields.push({
            name: fieldName,
            type: fieldName === 'email' ? 'email' : fieldName === 'website' ? 'url' : 'text',
            label: fieldName === 'whatsapp' ? 'WhatsApp' :
              fieldName === 'telephone' ? 'Téléphone' :
                fieldName === 'email' ? 'Email' : 'Site web',
            required: fieldName === 'whatsapp', // Seul WhatsApp obligatoire
            placeholder: fieldName === 'whatsapp' ? '+237 6XX XX XX XX' :
              fieldName === 'telephone' ? '+237 6XX XX XX XX' :
                fieldName === 'email' ? 'contact@exemple.com' : 'https://...'
          } as any);
        }
      });
    }

    // ✅ NOUVEAU 2025-11-06: Trier les champs du bloc Produits selon l'ordre souhaité
    const productsBlockIndex = blocksWithFixedOnes.findIndex(b => b.id === 'products');
    if (productsBlockIndex !== -1 && blocksWithFixedOnes[productsBlockIndex].fields.length > 0) {
      blocksWithFixedOnes[productsBlockIndex].fields = sortProductFields(blocksWithFixedOnes[productsBlockIndex].fields);
      console.log('[FormulaireYukpoIntelligentScreen] ✅ Champs du bloc Produits triés:', blocksWithFixedOnes[productsBlockIndex].fields.map(f => f.name));
    }

    return blocksWithFixedOnes.filter(block => block.fields.length > 0);
  };

  // Fonction de validation des champs
  const validateField = (field: DynamicField, value: any): { isValid: boolean; error: string } => {
    // Champ obligatoire vide
    if (field.required && (!value || value.toString().trim() === '')) {
      return { isValid: false, error: `${field.label} est obligatoire` };
    }

    // Validation spécifique pour WhatsApp
    if (field.name === 'whatsapp' && value) {
      const whatsappRegex = /^(\+?237|00237)?[0-9]{9}$/;
      const cleanValue = value.replace(/\s/g, '');
      if (!whatsappRegex.test(cleanValue)) {
        return { isValid: false, error: 'Numéro WhatsApp invalide (ex: +237 6XX XX XX XX)' };
      }
    }

    // Validation spécifique pour téléphone
    if (field.name === 'telephone' && value) {
      const phoneRegex = /^(\+?237|00237)?[0-9]{9}$/;
      const cleanValue = value.replace(/\s/g, '');
      if (!phoneRegex.test(cleanValue)) {
        return { isValid: false, error: 'Numéro de téléphone invalide' };
      }
    }

    // Validation spécifique pour email
    if ((field.type === 'email' || field.name === 'email') && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { isValid: false, error: 'Adresse email invalide' };
      }
    }

    // Validation spécifique pour URL
    if ((field.type === 'url' || field.name === 'website') && value) {
      const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
      if (!urlRegex.test(value)) {
        return { isValid: false, error: 'URL invalide (ex: https://exemple.com)' };
      }
    }

    return { isValid: true, error: '' };
  };

  // ✅ NOUVEAU: Vérifier si le bloc produits contient au moins un produit
  const hasAtLeastOneProduct = (): boolean => {
    // ✅ NOUVEAU 2025-11-06: Vérifier PLUSIEURS sources de produit

    // 1. Champ autocomplete 'produits' (LinearAutocompleteEditor)
    const productsValue = valeursFormulaire['produits'];
    if (Array.isArray(productsValue)) {
      // Pour autocomplete: chaque élément est une string concaténée (ex: "nom,marque,categorie,prix,quantite")
      // On considère qu'un produit existe si la string n'est pas vide après trim
      const hasAutocompleteProduct = productsValue.length > 0 && productsValue.some(product =>
        typeof product === 'string' && product.trim().length > 0
      );
      if (hasAutocompleteProduct) {
        console.log('[hasAtLeastOneProduct] ✅ Produit trouvé via autocomplete');
        return true;
      }
    } else if (productsValue && typeof productsValue === 'object' && 'valeur' in productsValue) {
      // Format objet complexe depuis l'IA
      const valeur = productsValue.valeur;
      if (Array.isArray(valeur) && valeur.length > 0) {
        console.log('[hasAtLeastOneProduct] ✅ Produit trouvé via autocomplete (format objet IA)');
        return true;
      }
    }

    // 2. Champ price_variant (PriceVariantSelector)
    const priceVariantValue = valeursFormulaire['price_variant'] || valeursFormulaire['variabilite_prix'];
    if (priceVariantValue && typeof priceVariantValue === 'object' && 'modalites' in priceVariantValue) {
      const modalites = priceVariantValue.modalites;
      if (Array.isArray(modalites) && modalites.length > 0) {
        console.log('[hasAtLeastOneProduct] ✅ Produit trouvé via price_variant');
        return true;
      }
    }

    // 3. Champs individuels (nom_produit + au moins prix OU categorie)
    const nomProduit = valeursFormulaire['nom_produit'];
    const categorieProduit = valeursFormulaire['categorie_produit'];
    const prixProduit = valeursFormulaire['prix_produit'] || valeursFormulaire['prix'];

    if (nomProduit && typeof nomProduit === 'string' && nomProduit.trim().length > 0) {
      if (categorieProduit || prixProduit) {
        console.log('[hasAtLeastOneProduct] ✅ Produit trouvé via champs individuels (nom + catégorie/prix)');
        return true;
      }
    }

    console.log('[hasAtLeastOneProduct] ❌ Aucun produit trouvé', {
      productsValue,
      priceVariantValue,
      nomProduit,
      categorieProduit,
      prixProduit
    });

    return false;
  };

  // Fonction de validation d'un bloc complet
  const validateCurrentBlock = (): { isValid: boolean; errors: string[]; fieldErrors: Record<string, string> } => {
    const currentBlockData = blocks[currentBlock];
    if (!currentBlockData) return { isValid: true, errors: [], fieldErrors: {} };

    const errors: string[] = [];
    const newFieldErrors: Record<string, string> = {};

    // ✅ NOUVEAU: Validation spéciale pour le bloc produits - doit contenir au moins un produit
    // ✅ NOUVEAU 2025-11-06: Lever contrainte si mode edit_service_info (on édite juste les infos du service)
    if (currentBlockData.id === 'products' && !isEditingServiceInfo) {
      if (!hasAtLeastOneProduct()) {
        errors.push('Le bloc Produits est obligatoire. Vous devez ajouter au moins un produit ou une prestation.');
        newFieldErrors['produits'] = 'Au moins un produit est requis';
      }
    }

    // Validation des champs individuels
    currentBlockData.fields.forEach(field => {
      const value = valeursFormulaire[field.name];
      const validation = validateField(field, value);

      if (!validation.isValid) {
        errors.push(validation.error);
        newFieldErrors[field.name] = validation.error;
      }
    });

    return { isValid: errors.length === 0, errors, fieldErrors: newFieldErrors };
  };

  // Fonctions de navigation entre blocs
  const goToNextBlock = () => {
    // Valider le bloc actuel avant de passer au suivant
    const validation = validateCurrentBlock();

    if (!validation.isValid) {
      // Afficher les erreurs dans les champs
      setFieldErrors(validation.fieldErrors);

      Alert.alert(
        'Champs invalides',
        validation.errors.join('\n\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    // Effacer les erreurs si la validation réussit
    setFieldErrors({});

    const currentVisibleIndex = displayedBlocks.findIndex(item => item.index === currentBlock);
    const nextVisible = currentVisibleIndex !== -1 ? displayedBlocks[currentVisibleIndex + 1] : null;

    if (nextVisible) {
      setBlockHorizontalScrollEnabled(true);
      setCurrentBlock(nextVisible.index);
      const targetDisplayIndex = currentVisibleIndex + 1;
      if (targetDisplayIndex >= 0) {
        blockContentRef.current?.scrollTo({
          x: targetDisplayIndex * width,
          y: 0,
          animated: true
        });
      }
    }
  };

  const goToPreviousBlock = () => {
    const currentVisibleIndex = displayedBlocks.findIndex(item => item.index === currentBlock);
    const previousVisible = currentVisibleIndex > 0 ? displayedBlocks[currentVisibleIndex - 1] : null;

    if (previousVisible) {
      setBlockHorizontalScrollEnabled(true);
      setCurrentBlock(previousVisible.index);
      const targetDisplayIndex = currentVisibleIndex - 1;
      if (targetDisplayIndex >= 0) {
        blockContentRef.current?.scrollTo({
          x: targetDisplayIndex * width,
          y: 0,
          animated: true
        });
      }
    }
  };

  const goToBlock = (blockIndex: number) => {
    const targetDisplayIndex = displayedBlocks.findIndex(item => item.index === blockIndex);

    if (blockIndex < 0 || !blocks[blockIndex] || targetDisplayIndex === -1) {
      return;
    }

    const productsBlockIndex = blocks.findIndex(b => b.id === 'products');

    // ✅ CORRECTION: Empêcher de passer à un bloc après le bloc produits si le bloc produits n'a pas de produits
    // ✅ NOUVEAU 2025-11-06: Lever contrainte si mode edit_service_info
    if (productsBlockIndex !== -1 && currentBlock === productsBlockIndex && blockIndex > productsBlockIndex && !isEditingServiceInfo) {
      if (!hasAtLeastOneProduct()) {
        Alert.alert(
          'Bloc Produits obligatoire',
          'Vous devez ajouter au moins un produit ou une prestation avant de continuer.',
          [{ text: 'OK' }]
        );
        setFieldErrors({ produits: 'Au moins un produit est requis' });
        return;
      }
    }

    setCurrentBlock(blockIndex);
    setBlockHorizontalScrollEnabled(true);

    blockContentRef.current?.scrollTo({
      x: targetDisplayIndex * width,
      y: 0,
      animated: true
    });
  };

  // ✅ NOUVEAU: Charger les données du service en mode édition
  useEffect(() => {
    const loadServiceData = async () => {
      if ((mode === 'edit' || mode === 'edit_service_info') && serviceId) {
        console.log('[FormulaireYukpoIntelligentScreen] 📝 Mode édition - Chargement du service:', serviceId, { mode });

        try {
          // ✅ CORRIGÉ: Utilise apiGet
          const response = await apiGet(`/api/services/${serviceId}`);

          if (response.success && response.data) {
            const serviceData: any = response.data;
            console.log('[FormulaireYukpoIntelligentScreen] ✅ Service chargé:', serviceData);

            // Extraire et pré-remplir TOUS les champs du service
            const formValues: Record<string, any> = {};

            if (serviceData?.data) {
              Object.keys(serviceData.data).forEach(key => {
                // ✅ CORRECTION: Ne pas mettre produits dans formValues, les gérer séparément
                if (key !== 'produits') {
                  const value = serviceData.data[key];
                  formValues[key] = value?.valeur !== undefined ? value.valeur : value;
                }
              });
            }

            // ✅ S'assurer que les contacts sont bien chargés
            formValues.whatsapp = serviceData.data?.whatsapp?.valeur || serviceData.whatsapp || '';
            formValues.telephone = serviceData.data?.telephone?.valeur || serviceData.telephone || '';
            formValues.email = serviceData.data?.email?.valeur || serviceData.email || '';
            formValues.website = serviceData.data?.website?.valeur || serviceData.website || serviceData.siteweb || '';

            console.log('[FormulaireYukpoIntelligentScreen] ✅ Contacts chargés:', {
              whatsapp: formValues.whatsapp,
              telephone: formValues.telephone,
              email: formValues.email,
              website: formValues.website
            });

            // ✅ SUPPRIMÉ: Chargement produits - Les produits sont maintenant gérés via les champs dynamiques du formulaire
            // Les produits existants seront chargés automatiquement via les valeurs du formulaire

            setValeursFormulaire(formValues);
            setActiveStep(2); // Aller directement au formulaire
          }
        } catch (error: any) {
          console.error('[FormulaireYukpoIntelligentScreen] Erreur chargement service:', error);
          handleAPIError(error, 'Chargement du service');
        }
      } else {
        // Mode création : charger les contacts du dernier service
        loadLastServiceContactInfo();
      }
    };

    const loadLastServiceContactInfo = async () => {
      if (!user?.id) return;

      try {
        // ✅ CORRIGÉ: Utilise apiGet
        const response = await apiGet('/api/services/last');

        if (response.success && response.data) {
          const data: any = response.data;
          if (data && Object.keys(data).length > 0) {
            const contactData = {
              whatsapp: data?.whatsapp?.valeur || data?.whatsapp || '',
              telephone: data?.telephone?.valeur || data?.telephone || '',
              email: data?.email?.valeur || data?.email || '',
              website: data?.website?.valeur || data?.website || data?.siteweb?.valeur || data?.siteweb || ''
            };

            // Pré-remplir les champs de contact s'ils ne sont pas déjà remplis
            setValeursFormulaire(prev => ({
              ...contactData,
              ...prev // Les données IA ont la priorité
            }));
            console.log('[FormulaireYukpoIntelligentScreen] Contacts précédents chargés:', contactData);
          }
        }
      } catch (error) {
        console.warn('[FormulaireYukpoIntelligentScreen] Impossible de charger les contacts précédents:', error);
      }
    };

    loadServiceData();
  }, [user?.id, mode, serviceId]);

  // ✅ NOUVEAU: Gérer l'ouverture automatique du bloc produits
  useEffect(() => {
    // Cas 1: Édition d'un produit spécifique
    if (editProductData && focusProductId && serviceId) {
      console.log('[FormulaireYukpoIntelligentScreen] 📝 Mode édition produit spécifique:', {
        productId: focusProductId,
        productName: editProductData.nom,
        serviceId
      });

      // Trouver le bloc produits et l'ouvrir
      const productsBlockIndex = blocks.findIndex(block => block.id === 'products');
      if (productsBlockIndex !== -1) {
        setCurrentBlock(productsBlockIndex);
        console.log('[FormulaireYukpoIntelligentScreen] ✅ Bloc produits ouvert automatiquement (édition)');
      }

      // ✅ SUPPRIMÉ: Recherche produit - Les produits sont maintenant gérés via les champs dynamiques
    }
    // Cas 2: Création d'un nouveau produit (focusBlock uniquement)
    else if (focusBlock === 'products' && blocks.length > 0) {
      console.log('[FormulaireYukpoIntelligentScreen] 📦 Ouverture automatique du bloc produits pour création');
      const productsBlockIndex = blocks.findIndex(block => block.id === 'products');
      if (productsBlockIndex !== -1) {
        setCurrentBlock(productsBlockIndex);
        console.log('[FormulaireYukpoIntelligentScreen] ✅ Bloc produits ouvert automatiquement (création)');
      }
    }
  }, [editProductData, focusProductId, serviceId, blocks, focusBlock]);

  // Traiter les données IA au chargement (comme le frontend)
  useEffect(() => {
    try {
      console.log('[FormulaireYukpoIntelligentScreen] useEffect - Traitement des données IA au chargement');
      console.log('[FormulaireYukpoIntelligentScreen] Suggestion disponible:', !!suggestion);
      console.log('[FormulaireYukpoIntelligentScreen] Suggestion.data:', suggestion?.data);

      if (suggestion && suggestion.data && typeof suggestion.data === 'object') {
        console.log('[FormulaireYukpoIntelligentScreen] Données IA disponibles, génération automatique des composants');

        // ✅ NOUVEAU 2025-11-04: Log complet du JSON IA pour diagnostic
        try {
          console.log('[FormulaireYukpoIntelligentScreen] 📋 JSON COMPLET de l\'IA:', JSON.stringify(suggestion.data, null, 2));
        } catch (e) {
          console.warn('[FormulaireYukpoIntelligentScreen] Impossible de stringify suggestion.data');
        }

        console.log('[FormulaireYukpoIntelligentScreen] 🔍 Champs DISTINCTS dans l\'IA:', {
          // Bloc Informations Générales
          titre_service: suggestion.data.titre_service?.valeur || suggestion.data.titre_service,
          category: suggestion.data.category?.valeur || suggestion.data.category,
          description: suggestion.data.description?.valeur || suggestion.data.description,
          // Bloc Produits
          nom_produit: suggestion.data.nom_produit?.valeur || suggestion.data.nom_produit || '❌ ABSENT',
          categorie_produit: suggestion.data.categorie_produit?.valeur || suggestion.data.categorie_produit || '❌ ABSENT',
          description_produit: suggestion.data.description_produit?.valeur || suggestion.data.description_produit || '❌ ABSENT'
        });

        // Traiter les suggestions IA comme dans le frontend
        const components = processIASuggestion(suggestion);

        if (!Array.isArray(components)) {
          console.error('[FormulaireYukpoIntelligentScreen] ❌ processIASuggestion n\'a pas retourné un array');
          return;
        }

        console.log('[FormulaireYukpoIntelligentScreen] Composants générés automatiquement:', components.length);

        // Extraire les valeurs des données IA pour pré-remplir les champs
        const initialValues: Record<string, any> = {};
        Object.keys(suggestion.data || {}).forEach(fieldName => {
          const fieldData = suggestion.data[fieldName];

          // ✅ CORRECTION: Traiter tous les champs produits, y compris produits (autocomplete) et price_variant
          if (fieldData && typeof fieldData === 'object' && 'valeur' in fieldData) {
            const typeDonnee = fieldData.type_donnee || 'string';

            // ✅ NOUVEAU: Traitement spécial pour le champ produits (autocomplete)
            if (fieldName === 'produits' && typeDonnee === 'autocomplete') {
              // Pour autocomplete, garder toute la structure avec sous_caracteristiques
              initialValues[fieldName] = {
                type_donnee: 'autocomplete',
                valeur: Array.isArray(fieldData.valeur) ? fieldData.valeur : [],
                separateur: fieldData.separateur || ',',
                sous_caracteristiques: fieldData.sous_caracteristiques || {},
                identifiant_base: fieldData.identifiant_base || 'produits',
                filtrable: fieldData.filtrable !== false,
                origine_champs: fieldData.origine_champs || 'ia'
              };
              console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ produits (autocomplete) pré-rempli:`, initialValues[fieldName]);
            }
            // ✅ NOUVEAU: Traitement spécial pour price_variant (variabilite_prix)
            else if (typeDonnee === 'price_variant' || fieldName === 'variabilite_prix') {
              // Pré-remplir la structure complète avec prix si identifiés
              const modalitesAvecValeurs = (fieldData.modalites || []).map((mod: any) => ({
                valeur: mod.valeur || '',
                prix: (mod.prix !== null && mod.prix !== undefined && mod.prix !== 0) ? mod.prix : 0,
                devise: mod.devise || 'XAF',
                stock: mod.stock
              }));

              initialValues[fieldName] = {
                type_donnee: 'price_variant',
                variable: fieldData.variable || 'variante',
                modalites: modalitesAvecValeurs,
                filtrable: fieldData.filtrable !== false,
                origine_champs: fieldData.origine_champs || 'ia'
              };
              console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ price_variant pré-rempli:`, initialValues[fieldName]);
            }
            // ✅ NOUVEAU: Pré-remplir les prix s'ils sont identifiés
            else if (fieldName === 'prix_produit' || fieldName === 'devise_produit') {
              const valeur = fieldData.valeur;
              if (valeur !== null && valeur !== undefined && valeur !== '') {
                initialValues[fieldName] = valeur;
                console.log(`[FormulaireYukpoIntelligentScreen] ✅ Prix pré-rempli depuis l'IA pour ${fieldName}:`, valeur);
              }
            }
            else {
              // Pour les autres champs, extraire juste la valeur
              initialValues[fieldName] = fieldData.valeur;
              console.log(`[FormulaireYukpoIntelligentScreen] Valeur pré-remplie automatiquement pour ${fieldName}:`, fieldData.valeur);
            }
          } else if (typeof fieldData === 'string' || typeof fieldData === 'number' || typeof fieldData === 'boolean') {
            // Gérer les valeurs directes (pas dans un objet {valeur: ...})
            initialValues[fieldName] = fieldData;
            console.log(`[FormulaireYukpoIntelligentScreen] Valeur directe pour ${fieldName}:`, fieldData);
          }
        });

        // ✅ CRITIQUE 2025-11-02: S'assurer que nom_produit, categorie_produit, description_produit sont chargés
        const productFields = ['nom_produit', 'categorie_produit', 'description_produit', 'prix_produit', 'devise_produit', 'produits'];
        const detectedProductFields = productFields.filter(field => field in initialValues);
        if (detectedProductFields.length > 0) {
          console.log(`[FormulaireYukpoIntelligentScreen] ✅ ${detectedProductFields.length} champs produits détectés depuis l'IA:`, detectedProductFields);

          // Log détaillé pour chaque champ produit critique
          ['nom_produit', 'categorie_produit', 'description_produit'].forEach(field => {
            if (initialValues[field]) {
              console.log(`[FormulaireYukpoIntelligentScreen] ✅ ${field} chargé:`, initialValues[field]);
            } else {
              console.warn(`[FormulaireYukpoIntelligentScreen] ⚠️ ${field} NON trouvé dans les données IA`);
            }
          });
        } else {
          console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Aucun champ produit détecté depuis l\'IA');
        }

        // CORRECTION: S'assurer que le champ category est bien chargé
        if (suggestion.data.category) {
          const categoryValue = typeof suggestion.data.category === 'object' && 'valeur' in suggestion.data.category
            ? suggestion.data.category.valeur
            : suggestion.data.category;
          initialValues.category = categoryValue;
          console.log('[FormulaireYukpoIntelligentScreen] Catégorie chargée:', categoryValue);
        }

        // ✅ CORRECTION 2025-11-04: Extraire les champs produit avec fallback intelligent UNIQUEMENT si l'IA génère des produits
        // Si l'IA a généré une structure produit (nom_produit OU prix_produit OU produits), on utilise ses valeurs
        // Sinon, on considère que l'IA n'a pas voulu créer de produit et on n'en crée pas non plus

        const hasProductData = suggestion.data.nom_produit || suggestion.data.prix_produit || suggestion.data.produits || suggestion.data.variabilite_prix;

        // Extraire nom_produit avec fallback intelligent
        if (suggestion.data.nom_produit) {
          const nomProduitValue = typeof suggestion.data.nom_produit === 'object' && 'valeur' in suggestion.data.nom_produit
            ? suggestion.data.nom_produit.valeur
            : suggestion.data.nom_produit;
          initialValues.nom_produit = nomProduitValue;
          console.log('[FormulaireYukpoIntelligentScreen] ✅ nom_produit chargé depuis IA:', nomProduitValue);
        } else if (hasProductData && suggestion.data.titre_service) {
          // Fallback intelligent: Si l'IA a créé un produit mais sans nom, utiliser le titre du service
          const fallbackNom = typeof suggestion.data.titre_service === 'object' && 'valeur' in suggestion.data.titre_service
            ? suggestion.data.titre_service.valeur
            : suggestion.data.titre_service;
          initialValues.nom_produit = fallbackNom;
          console.log('[FormulaireYukpoIntelligentScreen] ✅ nom_produit fallback depuis titre_service:', fallbackNom);
        }

        // Extraire categorie_produit avec fallback intelligent
        if (suggestion.data.categorie_produit) {
          const categorieProduitValue = typeof suggestion.data.categorie_produit === 'object' && 'valeur' in suggestion.data.categorie_produit
            ? suggestion.data.categorie_produit.valeur
            : suggestion.data.categorie_produit;
          initialValues.categorie_produit = categorieProduitValue;
          console.log('[FormulaireYukpoIntelligentScreen] ✅ categorie_produit chargé depuis IA:', categorieProduitValue);
        } else if (hasProductData && suggestion.data.category) {
          // Fallback intelligent: Si l'IA a créé un produit mais sans catégorie, utiliser la catégorie du service
          const fallbackCategorie = typeof suggestion.data.category === 'object' && 'valeur' in suggestion.data.category
            ? suggestion.data.category.valeur
            : suggestion.data.category;
          initialValues.categorie_produit = fallbackCategorie;
          console.log('[FormulaireYukpoIntelligentScreen] ✅ categorie_produit fallback depuis category:', fallbackCategorie);
        }

        // Extraire description_produit avec fallback intelligent
        if (suggestion.data.description_produit) {
          const descriptionProduitValue = typeof suggestion.data.description_produit === 'object' && 'valeur' in suggestion.data.description_produit
            ? suggestion.data.description_produit.valeur
            : suggestion.data.description_produit;
          initialValues.description_produit = descriptionProduitValue;
          console.log('[FormulaireYukpoIntelligentScreen] ✅ description_produit chargé depuis IA:', descriptionProduitValue);
        } else if (hasProductData && suggestion.data.description) {
          // Fallback intelligent: Si l'IA a créé un produit mais sans description, utiliser la description du service
          const fallbackDescription = typeof suggestion.data.description === 'object' && 'valeur' in suggestion.data.description
            ? suggestion.data.description.valeur
            : suggestion.data.description;
          initialValues.description_produit = fallbackDescription;
          console.log('[FormulaireYukpoIntelligentScreen] ✅ description_produit fallback depuis description:', fallbackDescription);
        }

        console.log('[FormulaireYukpoIntelligentScreen] 📦 RÉSUMÉ champs distincts (service vs produit):', {
          // Service
          titre_service: initialValues.titre_service,
          category: initialValues.category,
          description: initialValues.description,
          // Produit
          nom_produit: initialValues.nom_produit,
          categorie: initialValues.categorie_produit,
          description: initialValues.description_produit
        });

        // ✅ NOUVEAU: Pré-remplir le GPS depuis ChatInputMobile si disponible
        if (gpsData && gpsData.gps_fixe) {
          initialValues.gps_fixe = gpsData.gps_fixe;
          console.log('[FormulaireYukpoIntelligentScreen] ✅ GPS fixe pré-rempli depuis ChatInputMobile:', gpsData.gps_fixe);

          // Parser pour afficher dans le state local aussi
          const firstPoint = gpsData.gps_fixe.split('|')[0].split(',');
          if (firstPoint.length === 2) {
            const lat = parseFloat(firstPoint[0]);
            const lng = parseFloat(firstPoint[1]);
            setSelectedLocation({ lat, lng });
            console.log('[FormulaireYukpoIntelligentScreen] ✅ Position GPS définie:', { lat, lng });
          }
        }

        // ✅ NOUVEAU: Charger les catégories de produits suggérées (matching local basé sur keywords + données IA)
        if (initialValues.titre_service || initialValues.description || initialValues.category || suggestion?.data) {
          try {
            const suggestions = getSuggestedProductCategories(
              initialValues.titre_service,
              initialValues.description,
              initialValues.category,
              suggestion?.data
            );
            if (suggestions.length > 0) {
              console.log('[FormulaireYukpoIntelligentScreen] ✅ Catégories suggérées (matching local):', suggestions.length);
              setSuggestedProductCategories(suggestions); // Déjà limité à 3 par le matching local
            }
          } catch (error) {
            console.warn('[FormulaireYukpoIntelligentScreen] Erreur chargement suggestions catégories:', error);
          }
        }

        console.log('[FormulaireYukpoIntelligentScreen] Valeurs initiales automatiques:', initialValues);

        // ✅ CRITIQUE 2025-11-03: Organiser les blocs directement avec initialValues
        const organizedBlocks = organizeFieldsIntoBlocks(components, initialValues);

        // ✅ CORRECTION CRITIQUE 2025-11-06: Extraire aussi les field.value des composants générés
        // Les champs nom_produit, categorie_produit, description_produit ont leurs valeurs dans field.value
        const componentValues: Record<string, any> = {};
        components.forEach(field => {
          if (field.value !== undefined && field.value !== null && field.value !== '') {
            componentValues[field.name] = field.value;
            console.log(`[FormulaireYukpoIntelligentScreen] ✅ Valeur extraite de component: ${field.name} = ${field.value}`);
          }
        });

        // Mettre à jour les states
        setComposants(components);
        setDynamicTextareaHeights({});
        setBlocks(organizedBlocks);  // ✅ Utilise les valeurs IA !
        setValeursFormulaire(prev => ({
          ...prev, // Garder les contacts précédents
          ...initialValues, // Les données IA depuis suggestion.data
          ...componentValues // ✅ NOUVEAU: Les valeurs des field.value (nom_produit, etc.)
        }));
        setActiveStep(2); // Passer directement à l'étape 2 avec les données IA
        setCurrentBlock(0);
      } else {
        console.log('[FormulaireYukpoIntelligentScreen] Aucune donnée IA, rester à l\'étape 1');
      }
    } catch (error) {
      console.error('[FormulaireYukpoIntelligentScreen] ❌ ERREUR CRITIQUE dans useEffect suggestion:', error);
      // Ne pas crasher l'app, afficher un message d'erreur
      Alert.alert(
        'Erreur de chargement',
        'Impossible de charger les données du formulaire. Veuillez réessayer.',
        [{ text: 'OK' }]
      );
    }
  }, [suggestion]); // Se déclenche quand suggestion change


  // ✅ NOUVEAU 2025-11-01: Préremplir le formulaire en mode add_product
  useEffect(() => {
    if (isAddingProduct && duplicateProduct && suggestion?.data) {
      console.log('[FormulaireYukpoIntelligentScreen] 📋 MODE ADD_PRODUCT détecté - Préremplissage...');
      console.log('[FormulaireYukpoIntelligentScreen] Service data:', suggestion.data);
      console.log('[FormulaireYukpoIntelligentScreen] Produit à dupliquer:', duplicateProduct);

      // Préremplir avec les données du service + produit dupliqué
      const produitValues: Record<string, any> = {
        nom_produit: duplicateProduct.nom || '',
        prix_produit: duplicateProduct.prix || '',
        devise_produit: duplicateProduct.devise || 'XAF',
        description_produit: duplicateProduct.description || '',
        categorie_produit: duplicateProduct.type || '',
      };

      // Ajouter tous les autres champs du produit dupliqué
      Object.keys(duplicateProduct).forEach(key => {
        if (!['nom', 'prix', 'devise', 'description', 'type', 'id'].includes(key)) {
          produitValues[key] = duplicateProduct[key];
        }
      });

      console.log('[FormulaireYukpoIntelligentScreen] ✅ Valeurs produit extraites:', produitValues);

      setValeursFormulaire(prev => ({
        ...suggestion.data, // Données service complètes
        ...produitValues // Surcharger avec produit dupliqué
      }));

      setActiveStep(2); // Aller directement au formulaire

      // Focus sur le bloc produits après un court délai
      setTimeout(() => {
        const productsBlockIndex = blocks.findIndex(b => b.id === 'products');
        if (productsBlockIndex >= 0) {
          setCurrentBlock(productsBlockIndex);
          console.log('[FormulaireYukpoIntelligentScreen] ✅ Focus sur bloc produits, index:', productsBlockIndex);
        }
      }, 500);
    }
  }, [isAddingProduct, duplicateProduct, suggestion, blocks]);

  // Organiser les champs en blocs quand les composants ou valeursFormulaire changent
  useEffect(() => {
    if (composants.length > 0) {
      const organizedBlocks = organizeFieldsIntoBlocks(composants, valeursFormulaire);
      setBlocks(organizedBlocks);
      console.log('[FormulaireYukpoIntelligentScreen] Blocs organisés avec valeurs:', organizedBlocks);
    }
  }, [composants, valeursFormulaire]); // Se déclenche quand valeursFormulaire change

  // ✅ NOUVEAU : Scroll automatique vers le bloc courant (amélioré)
  // ✅ DÉSACTIVÉ : Le scroll manuel gère maintenant le changement de bloc
  // Ne plus forcer le scroll automatique pour permettre le scroll manuel
  // useEffect(() => {
  //   if (blockContentRef.current && displayedBlocks.length > 0) {
  //     const displayIndex = displayedBlocks.findIndex(item => item.index === currentBlock);
  //     if (displayIndex >= 0) {
  //       blockContentRef.current.scrollTo({
  //         x: displayIndex * width,
  //         animated: true
  //       });
  //     }
  //   }
  // }, [currentBlock, displayedBlocks]);

  // ✅ NOUVEAU : Scroll automatique vers le bloc produits si focusBlock === 'produits'
  useEffect(() => {
    if (focusBlock === 'produits' && blocks.length > 0 && activeStep === 2) {
      // Trouver l'index du bloc produits
      const productsBlockIndex = blocks.findIndex(block => block.id === 'products');

      if (productsBlockIndex >= 0) {
        console.log('[FormulaireYukpoIntelligentScreen] 📦 Navigation automatique vers le bloc produits, index:', productsBlockIndex);

        // Attendre un peu que les blocs soient rendus
        setTimeout(() => {
          setCurrentBlock(productsBlockIndex);
        }, 300);
      }
    }
  }, [focusBlock, blocks, activeStep]);

  // Générer le formulaire à partir des données IA (comme le frontend)
  const genererFormulaire = async () => {
    if (loading) return;

    try {
      setLoading(true);
      console.log('[FormulaireYukpoIntelligentScreen] Génération du formulaire à partir des données IA...');
      console.log('[FormulaireYukpoIntelligentScreen] Suggestion reçue:', suggestion);

      // CORRECTION: Utiliser les vraies données IA au lieu des composants mock
      if (suggestion && suggestion.data) {
        console.log('[FormulaireYukpoIntelligentScreen] Données IA disponibles:', suggestion.data);

        // Traiter les suggestions IA comme dans le frontend
        const components = processIASuggestion(suggestion);
        console.log('[FormulaireYukpoIntelligentScreen] Composants générés:', components);

        // Extraire les valeurs des données IA pour pré-remplir les champs
        // ✅ CORRECTION: Pré-remplir les prix s'ils sont identifiés par l'IA
        const initialValues: Record<string, any> = {};
        Object.keys(suggestion.data).forEach(fieldName => {
          const fieldData = suggestion.data[fieldName];

          // ✅ NOUVEAU: Pré-remplir les champs de prix s'ils sont présents dans les données IA
          if (fieldName === 'prix_produit' || fieldName === 'devise_produit') {
            if (fieldData && typeof fieldData === 'object' && 'valeur' in fieldData) {
              const valeur = fieldData.valeur;
              // Pré-remplir seulement si la valeur existe et n'est pas null
              if (valeur !== null && valeur !== undefined && valeur !== '') {
                initialValues[fieldName] = valeur;
                console.log(`[FormulaireYukpoIntelligentScreen] ✅ Prix pré-rempli depuis l'IA pour ${fieldName}:`, valeur);
              } else {
                console.log(`[FormulaireYukpoIntelligentScreen] Prix non identifié par l'IA pour ${fieldName}, laissé vide`);
              }
            }
            return;
          }

          // ✅ CORRECTION: Gestion spéciale pour price_variant (variabilite_prix)
          // Pré-remplir la structure complète (variable + valeurs des modalités + prix si identifiés)
          if (fieldName === 'variabilite_prix' || (fieldData && typeof fieldData === 'object' && fieldData.type_donnee === 'price_variant')) {
            if (fieldData && typeof fieldData === 'object') {
              // Pré-remplir la variable et les valeurs des modalités (ex: "38", "39", "M", "L")
              // ✅ NOUVEAU: Pré-remplir aussi les prix s'ils sont identifiés par l'IA
              const modalitesAvecValeurs = (fieldData.modalites || fieldData.valeur?.modalites || []).map((mod: any) => ({
                valeur: mod.valeur || '', // ✅ PRÉ-REMPLI: Garder la valeur de la variante (ex: "38", "M", "Rouge")
                prix: (mod.prix !== null && mod.prix !== undefined && mod.prix !== 0) ? mod.prix : 0, // ✅ PRÉ-REMPLI si identifié par l'IA, sinon 0
                devise: mod.devise || 'XAF', // Garder la devise suggérée
                stock: mod.stock // Garder le stock si présent
              }));

              initialValues[fieldName] = {
                type_donnee: 'price_variant',
                variable: fieldData.variable || 'variante', // ✅ PRÉ-REMPLI: variable (ex: "pointure", "taille")
                modalites: modalitesAvecValeurs, // ✅ PRÉ-REMPLI: valeurs des variantes + prix si identifiés
                filtrable: fieldData.filtrable !== false,
                origine_champs: 'ia'
              };
              console.log(`[FormulaireYukpoIntelligentScreen] ✅ Price variant structure pré-remplie pour ${fieldName}:`, initialValues[fieldName]);
            }
          } else if (fieldData && typeof fieldData === 'object' && 'valeur' in fieldData) {
            initialValues[fieldName] = fieldData.valeur;
            console.log(`[FormulaireYukpoIntelligentScreen] Valeur pré-remplie pour ${fieldName}:`, fieldData.valeur);
          } else if (typeof fieldData === 'string' || typeof fieldData === 'number' || typeof fieldData === 'boolean') {
            initialValues[fieldName] = fieldData;
            console.log(`[FormulaireYukpoIntelligentScreen] Valeur directe pour ${fieldName}:`, fieldData);
          }
        });

        // ✅ NOUVEAU: Extraire les variations de prix imbriquées dans le champ produits
        const iaProduitsNode = suggestion.data.produits;
        const priceVariantFromProduits = extractPriceVariant(
          iaProduitsNode,
          iaProduitsNode?.origine_champs || 'ia'
        );
        if (priceVariantFromProduits) {
          initialValues.variabilite_prix = priceVariantFromProduits;
          initialValues.price_variant = priceVariantFromProduits;
          const inferredCurrencyFromVariant = getCurrencyFromVariant(priceVariantFromProduits);
          if (inferredCurrencyFromVariant && (!initialValues.devise_produit || initialValues.devise_produit.length === 0)) {
            initialValues.devise_produit = inferredCurrencyFromVariant;
            initialValues.devise = inferredCurrencyFromVariant;
          }
          console.log('[FormulaireYukpoIntelligentScreen] ✅ Variabilité prix récupérée depuis produits:', priceVariantFromProduits);

          if (initialValues.produits) {
            initialValues.produits = applyPriceVariantToProduits(initialValues.produits, priceVariantFromProduits);
          } else if (iaProduitsNode) {
            initialValues.produits = applyPriceVariantToProduits(iaProduitsNode, priceVariantFromProduits);
          }
        }

        // CORRECTION: S'assurer que le champ category est bien chargé
        if (suggestion.data.category) {
          const categoryValue = typeof suggestion.data.category === 'object' && 'valeur' in suggestion.data.category
            ? suggestion.data.category.valeur
            : suggestion.data.category;
          initialValues.category = categoryValue;
          console.log('[FormulaireYukpoIntelligentScreen] Catégorie chargée:', categoryValue);
        }

        console.log('[FormulaireYukpoIntelligentScreen] Valeurs initiales:', initialValues);

        // ✅ CRITIQUE 2025-11-03: Organiser les blocs directement avec initialValues
        // Au lieu d'attendre que useEffect se déclenche avec valeursFormulaire vide
        const organizedBlocks = organizeFieldsIntoBlocks(components, initialValues);

        // ✅ CORRECTION CRITIQUE 2025-11-06: Extraire aussi les field.value des composants générés
        const componentValues: Record<string, any> = {};
        components.forEach(field => {
          if (field.value !== undefined && field.value !== null && field.value !== '') {
            componentValues[field.name] = field.value;
            console.log(`[FormulaireYukpoIntelligentScreen] ✅ Valeur extraite de component (mode edit): ${field.name} = ${field.value}`);
          }
        });

        // Mettre à jour les states
        const mergedInitialValues: Record<string, any> = {
          ...initialValues,
          ...componentValues // ✅ NOUVEAU: Les valeurs des field.value
        };

        const normalizedMergedVariant =
          extractPriceVariant(mergedInitialValues.variabilite_prix || mergedInitialValues.price_variant) ||
          extractPriceVariant(mergedInitialValues.produits);

        if (normalizedMergedVariant) {
          mergedInitialValues.variabilite_prix = normalizedMergedVariant;
          mergedInitialValues.price_variant = normalizedMergedVariant;
          const inferredCurrencyFromMergedVariant = getCurrencyFromVariant(normalizedMergedVariant);
          if (inferredCurrencyFromMergedVariant && (!mergedInitialValues.devise_produit || mergedInitialValues.devise_produit.length === 0)) {
            mergedInitialValues.devise_produit = inferredCurrencyFromMergedVariant;
            mergedInitialValues.devise = inferredCurrencyFromMergedVariant;
          }
          if (mergedInitialValues.produits) {
            mergedInitialValues.produits = applyPriceVariantToProduits(
              mergedInitialValues.produits,
              normalizedMergedVariant
            );
          }
        }

        setValeursFormulaire(mergedInitialValues);
        setComposants(components);
        setDynamicTextareaHeights({});
        setBlocks(organizedBlocks);  // ✅ Utilise les valeurs IA !
        setActiveStep(2);
        setCurrentBlock(0);
      } else {
        console.log('[FormulaireYukpoIntelligentScreen] Aucune donnée IA, utilisation des composants par défaut');

        // Fallback vers les composants par défaut si pas de données IA
        const defaultComponents = [
          {
            name: 'titre_service',
            type: 'text',
            label: 'Titre du service',
            required: true,
            placeholder: 'Ex: Restaurant Le Gourmet'
          },
          {
            name: 'description',
            type: 'textarea',
            label: 'Description',
            required: true,
            placeholder: 'Décrivez votre service...'
          },
          {
            name: 'prix',
            type: 'number',
            label: 'Prix',
            required: true,
            placeholder: '0'
          }
        ];

        setComposants(defaultComponents);
        setActiveStep(2);
        setCurrentBlock(0);
      }

    } catch (error) {
      console.error('[FormulaireYukpoIntelligentScreen] Erreur génération:', error);
      Alert.alert('Erreur', 'Impossible de générer le formulaire');
    } finally {
      setLoading(false);
    }
  };

  const getCurrencyFromVariant = (variant: any): string | undefined => {
    if (!variant) {
      return undefined;
    }

    const modalitesSource = Array.isArray(variant?.modalites)
      ? variant.modalites
      : Array.isArray(variant)
        ? variant
        : Array.isArray(variant?.valeur?.modalites)
          ? variant.valeur.modalites
          : [];

    for (const entry of modalitesSource) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const currencyRaw = typeof entry.devise === 'string' && entry.devise.trim().length > 0
        ? entry.devise.trim()
        : typeof entry.currency === 'string' && entry.currency.trim().length > 0
          ? entry.currency.trim()
          : undefined;

      if (currencyRaw) {
        return currencyRaw.toUpperCase();
      }
    }

    return undefined;
  };

  // Gérer les changements de champs
  const handleFieldChange = (fieldName: string, value: any) => {
    // Convertir automatiquement les prix en nombres
    let processedValue = value;
    if (fieldName === 'prix' && typeof value === 'string' && value.trim() !== '') {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        processedValue = numericValue;
      }
    }

    if (fieldName === 'produits') {
      setValeursFormulaire(prev => {
        const normalizedPriceVariant = extractPriceVariant(
          processedValue,
          processedValue?.origine_champs || prev?.produits?.origine_champs
        );

        const nextState: Record<string, any> = {
          ...prev
        };

        if (normalizedPriceVariant) {
          nextState.variabilite_prix = normalizedPriceVariant;
          nextState.price_variant = normalizedPriceVariant;
          nextState.produits = applyPriceVariantToProduits(processedValue, normalizedPriceVariant);
          const inferredCurrency = getCurrencyFromVariant(normalizedPriceVariant);
          if (inferredCurrency) {
            nextState.devise_produit = inferredCurrency;
            nextState.devise = inferredCurrency;
          }
        } else {
          nextState.produits = applyPriceVariantToProduits(
            processedValue,
            prev.variabilite_prix ? extractPriceVariant(prev.variabilite_prix) : null
          );
          if (!nextState.produits?.variation_prix && !nextState.produits?.variabilite_prix) {
            delete nextState.variabilite_prix;
            delete nextState.price_variant;
          }
        }

        return nextState;
      });
      return;
    }

    if (fieldName === 'variabilite_prix' || fieldName === 'price_variant') {
      const normalizedPriceVariant = extractPriceVariant(processedValue, processedValue?.origine_champs || 'formulaire');
      setValeursFormulaire(prev => {
        const nextState: Record<string, any> = {
          ...prev,
          [fieldName]: processedValue
        };

        if (normalizedPriceVariant) {
          const existingProduits = prev.produits
            ? applyPriceVariantToProduits(prev.produits, normalizedPriceVariant)
            : undefined;

          if (existingProduits) {
            nextState.produits = existingProduits;
          }
          nextState.variabilite_prix = normalizedPriceVariant;
          nextState.price_variant = normalizedPriceVariant;
          const inferredCurrency = getCurrencyFromVariant(normalizedPriceVariant);
          if (inferredCurrency) {
            nextState.devise_produit = inferredCurrency;
            nextState.devise = inferredCurrency;
          }
        } else if (prev.produits) {
          nextState.produits = applyPriceVariantToProduits(prev.produits, null);
          delete nextState.variabilite_prix;
          delete nextState.price_variant;
        }

        return nextState;
      });
      return;
    }

    setValeursFormulaire(prev => ({
      ...prev,
      [fieldName]: processedValue
    }));
  };

  // Gérer les changements d'images produit
  const updateProductImages = (nextImages: string[]) => {
    const { images: orderedImages, primary } = orderImagesWithPrimary(
      nextImages,
      primaryProductImage,
      MAX_PRODUCT_IMAGES
    );

    setPrimaryProductImage(primary);
    setMediaFiles((prev) => ({
      ...prev,
      images: orderedImages
    }));
  };

  // Gérer les changements de vidéos produit
  const updateProductVideos = (nextVideos: any[]) => {
    const videosList = Array.isArray(nextVideos) ? nextVideos : [];

    setMediaFiles((prev) => ({
      ...prev,
      videos: videosList
    }));
  };

  const updateBrandLogo = (nextLogo: string[]) => {
    const sanitizedLogo = normalizeMediaList(nextLogo);

    setMediaFiles((prev) => ({
      ...prev,
      logo: sanitizedLogo
    }));

    setValeursFormulaire((prev) => {
      const updated = { ...prev };

      if (sanitizedLogo.length > 0) {
        updated.logo = sanitizedLogo[0];
      } else {
        delete updated.logo;
      }

      return updated;
    });
  };

  const updateBrandBanner = (nextBanner: string[]) => {
    const sanitizedBanner = normalizeMediaList(nextBanner);

    setMediaFiles((prev) => ({
      ...prev,
      banner: sanitizedBanner
    }));

    setValeursFormulaire((prev) => {
      const updated = { ...prev };

      if (sanitizedBanner.length > 0) {
        updated.banner = sanitizedBanner[0];
        updated.banniere = sanitizedBanner[0];
      } else {
        delete updated.banner;
        delete updated.banniere;
      }

      return updated;
    });
  };

  // ✅ PHASE 3: Générer exemple dynamique pour autocomplete
  const generateDynamicExample = (field: DynamicField, currentValues: string[]): string => {
    // ✅ NOUVEAU 2025-11-04: Utiliser la combinaison IA comme placeholder si disponible
    const produitsField = valeursFormulaire[field.name];
    if (produitsField && typeof produitsField === 'object' && 'valeur' in produitsField) {
      const productVector = Array.isArray(produitsField.valeur) ? produitsField.valeur : [];
      const sousCaracs = produitsField.sous_caracteristiques || {};

      if (productVector.length > 0 && Object.keys(sousCaracs).length > 0) {
        // Utiliser la PREMIÈRE combinaison générée par l'IA
        const exemple = productVector[0];
        const labels = Object.keys(sousCaracs);

        console.log('[FormulaireYukpoIntelligent] ✅ Placeholder dynamique IA:', exemple);
        return `${exemple} 🤖 (IA)`;
      }
    }

    if (currentValues && currentValues.length > 0) {
      return currentValues[0]; // Première modalité comme exemple
    }

    // Exemple par défaut selon catégorie
    const categorie = valeursFormulaire.categorie_produit || valeursFormulaire.category || 'produit';
    const categorieNormalized = categorie.toLowerCase();

    const examples: Record<string, string> = {
      'vehicule': 'Toyota,Corolla,Noir,Yaoundé,2024,Neuf',
      'automobile': 'Toyota,Corolla,Noir,Yaoundé,2024,Neuf',
      'meuble': 'Canapé 3 places,Cuir,Marron,Douala,Moderne,Neuf',
      'telephone': 'Apple,iPhone 14 Pro,Noir,Yaoundé,256GB,Comme neuf',
      'smartphone': 'Samsung,Galaxy S24,Noir,Douala,128GB,Neuf',
      'vetement': 'Nike,Air Max,Blanc,Yaoundé - Bastos,42,Neuf',
      'chaussure': 'Adidas,Superstar,Blanc,Douala - Akwa,42,Comme neuf'
    };

    return examples[categorieNormalized] || 'Marque,Modèle,Couleur,Localisation,Année,État';
  };

  const renderProductsBlock = () => {
    const extractStringValue = (fieldName: string): string => {
      const raw = valeursFormulaire[fieldName];
      if (raw && typeof raw === 'object' && raw !== null && 'valeur' in raw) {
        const inner = raw.valeur;
        if (inner === null || inner === undefined) {
          return '';
        }
        if (typeof inner === 'string') {
          return inner;
        }
        if (typeof inner === 'number' || typeof inner === 'boolean') {
          return String(inner);
        }
        return '';
      }
      if (raw === null || raw === undefined) {
        return '';
      }
      if (typeof raw === 'string') {
        return raw;
      }
      if (typeof raw === 'number' || typeof raw === 'boolean') {
        return String(raw);
      }
      return '';
    };

    const typeOffreRaw = extractStringValue('type_offre') || extractStringValue('nature_offre') || 'produit';
    const typeOffreNormalized = typeOffreRaw.toLowerCase();
    const isPrestation = ['prestation', 'service', 'services'].includes(typeOffreNormalized);

    const nomProduit = extractStringValue('nom_produit');
    const categorieProduit = extractStringValue('categorie_produit');
    const descriptionProduit = extractStringValue('description_produit');
    const descriptionService = extractStringValue('description');
    const titreService = extractStringValue('titre_service');

    const prixProduitValue = extractStringValue('prix_produit') || extractStringValue('prix');
    const deviseProduitValue = extractStringValue('devise_produit') || extractStringValue('devise') || 'XAF';

    const produitsField = valeursFormulaire.produits;
    let produitsValues: string[] = [];
    let sousCaracteristiques =
      (produitsField && typeof produitsField === 'object' && produitsField !== null && produitsField.sous_caracteristiques)
        ? produitsField.sous_caracteristiques
        : (valeursFormulaire.sous_caracteristiques && typeof valeursFormulaire.sous_caracteristiques === 'object'
          ? valeursFormulaire.sous_caracteristiques
          : null);
    let safeSeparateur = ',';

    if (produitsField && typeof produitsField === 'object' && produitsField !== null && 'valeur' in produitsField) {
      const rawValues = Array.isArray(produitsField.valeur) ? produitsField.valeur : [produitsField.valeur];
      produitsValues = rawValues
        .filter((item) => item !== null && item !== undefined)
        .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
      if (typeof produitsField.separateur === 'string' && produitsField.separateur.trim().length > 0) {
        safeSeparateur = produitsField.separateur;
      }
    } else if (Array.isArray(produitsField)) {
      produitsValues = produitsField
        .filter((item) => item !== null && item !== undefined)
        .map((item) => (typeof item === 'string' ? item : String(item)));
    } else if (typeof produitsField === 'string') {
      produitsValues = [produitsField];
    }

    if (!sousCaracteristiques || typeof sousCaracteristiques !== 'object') {
      sousCaracteristiques = {
        marque: [],
        modele: [],
        couleur: ['Noir', 'Blanc', 'Gris', 'Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Rose', 'Violet'],
        annee: ['2024', '2023', '2022', '2021', '2020', '2019', '2018'],
        etat: ['Neuf', 'Comme neuf', 'Bon état', 'Très bon état', 'Occasion', 'À rénover'],
        version: [],
        competences: [],
        experience: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel'],
        niveau: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Professionnel']
      };
    }

    const variantsSource = valeursFormulaire.variabilite_prix || valeursFormulaire.price_variant;
    let currentModalites: any[] = [];
    if (variantsSource) {
      if (Array.isArray(variantsSource?.modalites)) {
        currentModalites = variantsSource.modalites;
      } else if (Array.isArray(variantsSource)) {
        currentModalites = variantsSource;
      }
    }
    const variantCurrency = getCurrencyFromVariant(variantsSource);
    const deviseProduitValue = extractStringValue('devise_produit') || extractStringValue('devise') || variantCurrency || 'XAF';
    const hasExistingVariants = currentModalites.length > 0;

    const locationField = valeursFormulaire.lieu_produit;
    const locationValue = locationField && typeof locationField === 'object' && locationField !== null && 'valeur' in locationField
      ? locationField.valeur
      : locationField || null;

    const contextValues = [
      descriptionProduit,
      descriptionService
    ].filter((item) => item && item.length > 0);

    const modaliteCurrencies = currentModalites
      .map((mod: any) => {
        if (!mod || typeof mod !== 'object') {
          return undefined;
        }
        if (typeof mod.devise === 'string' && mod.devise.trim().length > 0) {
          return mod.devise.trim().toUpperCase();
        }
        if (typeof mod.currency === 'string' && mod.currency.trim().length > 0) {
          return mod.currency.trim().toUpperCase();
        }
        return undefined;
      })
      .filter((currency?: string) => Boolean(currency)) as string[];

    const defaultCurrencyPool = [
      'XAF', 'XOF', 'USD', 'EUR', 'NGN', 'GHS', 'KES', 'TZS', 'UGX', 'RWF', 'BIF', 'CDF', 'ZMW', 'ZAR',
      'MAD', 'DZD', 'TND', 'EGP', 'LYD', 'MUR', 'MGA', 'MZN', 'AOA', 'SCR', 'KMF', 'SOS', 'SDG', 'SSP',
      'DJF', 'MRU', 'ERN', 'STN'
    ];

    const availableVariantCurrencies = Array.from(
      new Set(
        [
          ...modaliteCurrencies,
          variantCurrency,
          deviseProduitValue,
          ...defaultCurrencyPool
        ]
          .filter((currency): currency is string => Boolean(currency))
          .map((currency) => currency.toUpperCase())
      )
    );

    return (
      <View style={styles.productBlockContent}>
        <View style={styles.productIntroRow}>
          <View style={styles.productIntroIcon}>
            <SafeIcon name={isPrestation ? 'briefcase' : 'package-plus'} size={24} color="#FFFFFF" />
          </View>
          <View style={styles.productIntroTextWrapper}>
            <Text style={styles.productIntroTitle}>
              {isPrestation ? 'Informations prestation' : 'Informations produit'}
            </Text>
            <Text style={styles.productIntroSubtitle}>
              {isPrestation
                ? 'Décrivez votre prestation avec précision pour convaincre vos futurs clients.'
                : 'Présentez clairement les atouts de votre produit pour maximiser vos ventes.'}
            </Text>
          </View>
        </View>

        <View style={styles.productFieldGroup}>
          <Text style={styles.fieldLabel}>
            {isPrestation ? 'Nom de la prestation' : 'Nom du produit / prestation'}
          </Text>
          <NativeInput
            placeholder={isPrestation
              ? 'Ex: Cours de maths niveau terminal, Réparation écran téléphone...'
              : 'Ex: iPhone 14 Pro Max 256GB, Toyota RAV4 2018 4x4...'
            }
            value={nomProduit}
            onChangeText={(text) => handleFieldChange('nom_produit', text)}
            multiline
            minLines={1}
            style={[styles.fieldInput, styles.autoGrowingInput]}
          />
          {fieldErrors['nom_produit'] && (
            <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors['nom_produit'])}</Text>
          )}
        </View>

        <View style={styles.productFieldGroup}>
          <Text style={styles.fieldLabel}>Catégorie du produit / prestation</Text>
          <NativeInput
            placeholder="Ex: Smartphone, Cours particulier, Service de réparation..."
            value={categorieProduit}
            onChangeText={(text) => handleFieldChange('categorie_produit', text)}
            multiline
            minLines={1}
            style={[styles.fieldInput, styles.autoGrowingInput]}
          />
          {fieldErrors['categorie_produit'] && (
            <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors['categorie_produit'])}</Text>
          )}
        </View>

        <View style={styles.productFieldGroup}>
          <Text style={styles.fieldLabel}>Description du produit / prestation</Text>
          <NativeInput
            placeholder="Décrivez les caractéristiques spécifiques du produit / prestation..."
            value={descriptionProduit}
            onChangeText={(text) => handleFieldChange('description_produit', text)}
            multiline
            minLines={3}
            style={[styles.fieldInput, styles.productDescriptionInput]}
            inputStyle={styles.productDescriptionText}
          />
          {fieldErrors['description_produit'] && (
            <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors['description_produit'])}</Text>
          )}
        </View>

        <View style={styles.productFieldGroup}>
          <LinearAutocompleteEditor
            label={isPrestation ? 'Caractéristiques prestations' : 'Caractéristiques produits / prestations'}
            identifiantBase="produits"
            value={produitsValues}
            contextValues={contextValues}
            categoryValue={categorieProduit}
            onChange={(values, updatedSousCaracs) => {
              const nextSousCaracs = updatedSousCaracs || sousCaracteristiques || {};
              handleFieldChange('produits', {
                type_donnee: 'autocomplete',
                valeur: values,
                separateur: safeSeparateur,
                sous_caracteristiques: nextSousCaracs,
                identifiant_base: 'produits',
                filtrable: true,
                origine_champs: 'formulaire'
              });
              if (updatedSousCaracs) {
                handleFieldChange('sous_caracteristiques', updatedSousCaracs);
              }
            }}
            sousCaracteristiques={sousCaracteristiques || {}}
            separateur={safeSeparateur}
            allowCustomModality
            filtrable
            placeholder="Tapez pour voir les suggestions..."
          />
          {fieldErrors['produits'] && (
            <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors['produits'])}</Text>
          )}
        </View>

        {!hasExistingVariants && (
          <View style={styles.productFieldGroup}>
            <Text style={styles.fieldLabel}>Prix du produit / prestation</Text>
            <NativeInput
              placeholder="Ex: 150000"
              value={prixProduitValue}
              onChangeText={(value) => {
                handleFieldChange('prix_produit', value);
                handleFieldChange('prix', value);
              }}
              keyboardType="numeric"
              style={styles.fieldInput}
            />
            <View style={styles.productCurrencyInfo}>
              <Text style={styles.productCurrencyInfoLabel}>Devise estimée</Text>
              <Text style={styles.productCurrencyInfoValue}>
                {deviseProduitValue ? `${deviseProduitValue} (automatique)` : 'Déterminée automatiquement selon le lieu'}
              </Text>
            </View>
            {fieldErrors['prix_produit'] && (
              <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors['prix_produit'])}</Text>
            )}
          </View>
        )}

        {hasExistingVariants && (
          <View style={styles.productFieldGroup}>
            <PriceVariantSelector
              label={isPrestation ? 'Variantes prestation' : 'Variantes produit'}
              variable={isPrestation ? 'formule' : 'option'}
              modalites={currentModalites}
              onChange={(modalites) => {
                handleFieldChange('variabilite_prix', {
                  type_donnee: 'price_variant',
                  variable: isPrestation ? 'formule' : 'option',
                  modalites,
                  filtrable: true,
                  origine_champs: 'formulaire'
                });
              }}
              defaultCurrency={deviseProduitValue}
              availableCurrencies={availableVariantCurrencies}
              helperText="Modifiez les variations détectées par l'IA (prix, stock, image)."
              showEmptyStateDetails={false}
            />
          </View>
        )}

        <View style={styles.productFieldGroup}>
          <LocationSelector
            label="Lieu de commercialisation"
            value={locationValue}
            onSelect={(value) => {
              handleFieldChange('lieu_produit', {
                type_donnee: 'location',
                valeur: value,
                composants: { lieu: value },
                filtrable: true,
                origine_champs: 'formulaire'
              });
            }}
            placeholder="Ville, quartier, pays..."
            enrichWithBackend
            required
          />
          {fieldErrors['lieu_produit'] && (
            <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors['lieu_produit'])}</Text>
          )}
        </View>

        <View style={styles.productFieldGroup}>
          <Text style={styles.fieldLabel}>Photos et vidéos</Text>
          <MediaUploadManager
            images={mediaFiles.images}
            videos={mediaFiles.videos}
            onImagesChange={updateProductImages}
            onVideosChange={updateProductVideos}
            maxImages={MAX_PRODUCT_IMAGES}
            maxVideos={3}
            onHorizontalScrollStart={handleMediaHorizontalScrollStart}
            onHorizontalScrollEnd={handleMediaHorizontalScrollEnd}
          />
          <Text style={styles.productHint}>
            Ajoutez des visuels de haute qualité pour inspirer confiance et mettre votre offre en valeur.
          </Text>
        </View>
      </View>
    );
  };

  // Rendu d'un champ (aligné sur le frontend avec tous les types)
  const renderField = (field: DynamicField) => {
    // ✅ Log de debug pour chaque champ rendu
    if (field.name === 'produits') {
      console.log('[FormulaireYukpoIntelligentScreen] 🔍 Rendu du champ produits:', {
        name: field.name,
        type: field.type,
        typeDonnee: field.typeDonnee,
        label: field.label,
        hasIdentifiantBase: !!field.identifiantBase,
        hasSousCaracteristiques: !!field.sousCaracteristiques,
        nbSousCaracs: Object.keys(field.sousCaracteristiques || {}).length
      });
    }

    // ✅ NOUVEAU: Support pour les nouveaux types de données
    if (field.typeDonnee === 'autocomplete') {
      // ✅ CORRECTION 2025-11-04: Extraire correctement les valeurs si c'est un objet complexe
      const fieldValue = valeursFormulaire[field.name];
      let currentValues: string[] = [];
      let currentSousCaracs = field.sousCaracteristiques || {};

      if (fieldValue && typeof fieldValue === 'object' && 'valeur' in fieldValue) {
        // Cas objet complexe depuis l'IA {type_donnee, valeur, sous_caracteristiques}
        const rawValues = Array.isArray(fieldValue.valeur) ? fieldValue.valeur : [];
        // ✅ PROTECTION ULTIME 2025-11-06: S'assurer que TOUS les éléments sont des STRINGS
        currentValues = rawValues.map(v => {
          if (typeof v === 'string') {
            return v;
          } else if (v && typeof v === 'object') {
            console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Élément value n\'est pas string, conversion:', v);
            return JSON.stringify(v);
          } else if (v !== null && v !== undefined) {
            return String(v);
          }
          return '';
        }).filter(v => v.length > 0);

        currentSousCaracs = fieldValue.sous_caracteristiques || field.sousCaracteristiques || {};
        console.log('[FormulaireYukpoIntelligentScreen] ✅ Extraction objet complexe pour', field.name, {
          valeur: currentValues,
          sousCaracs: Object.keys(currentSousCaracs || {})
        });
      } else if (Array.isArray(fieldValue)) {
        // Cas array simple - ✅ PROTECTION: Garantir que tous les éléments sont strings
        currentValues = fieldValue.map(v => {
          if (typeof v === 'string') {
            return v;
          } else if (v && typeof v === 'object') {
            console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Élément array n\'est pas string, conversion:', v);
            return JSON.stringify(v);
          } else if (v !== null && v !== undefined) {
            return String(v);
          }
          return '';
        }).filter(v => v.length > 0);
      }

      // ✅ PROTECTION CRITIQUE: S'assurer que currentSousCaracs est un objet valide
      if (!currentSousCaracs || typeof currentSousCaracs !== 'object') {
        console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ sousCaracteristiques invalide pour', field.name);
        currentSousCaracs = {};
      }

      // ✅ PROTECTION CRITIQUE 2025-11-06: S'assurer que separateur est une string valide
      const safeSeparateur = (field.separateur && typeof field.separateur === 'string') ? field.separateur : ',';
      if (!field.separateur || typeof field.separateur !== 'string') {
        console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ field.separateur manquant/invalide pour', field.name, '- utilisation fallback ","');
      }

      const nbModalites = currentValues.length;
      const nbCaracteristiques = Object.keys(currentSousCaracs).length;

      console.log('[FormulaireYukpoIntelligentScreen] ✅ Rendu autocomplete pour:', field.name, {
        nbModalites,
        nbCaracteristiques,
        currentValues,
        nbSousCaracsDisponibles: Object.keys(currentSousCaracs).length,
        separateur: safeSeparateur
      });

      return (
        <View key={field.name} style={styles.fieldContainer}>
          {/* ✅ PHASE 3: Statistiques en temps réel */}
          {nbModalites > 0 && (
            <View style={styles.statsBox}>
              <SafeIcon name="bar-chart-2" size={14} color={modernColors.success} />
              <Text style={styles.statsText}>
                {nbModalites} modalité{nbModalites > 1 ? 's' : ''} créée{nbModalites > 1 ? 's' : ''}
              </Text>
              <View style={styles.statsDot} />
              <Text style={styles.statsSubtext}>
                {nbCaracteristiques} caractéristique{nbCaracteristiques > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/*
           * ✅ Ajustement 2025-11-09 :
           * - Pour les caractéristiques produits/prestations, on ne rapproche plus que via la description.
           */}
          <LinearAutocompleteEditor
            label={field.label}
            identifiantBase={field.identifiantBase || field.name || 'produit'}
            sousCaracteristiques={currentSousCaracs || {}} // ✅ PROTECTION: Garantir objet valide
            separateur={safeSeparateur} // ✅ PROTECTION ULTIME: Garantit string valide
            value={currentValues || []} // ✅ PROTECTION: Garantir array de strings valides
            contextValues={
              (field.identifiantBase || field.name) === 'produits'
                ? [
                  valeursFormulaire.description_produit,
                  valeursFormulaire.description,
                ]
                : [
                  valeursFormulaire.categorie_produit,
                  valeursFormulaire.category,
                  valeursFormulaire.description_produit,
                  valeursFormulaire.description,
                  valeursFormulaire.nom_produit,
                  valeursFormulaire.titre_service,
                ]
            }
            categoryValue={valeursFormulaire.categorie_produit || valeursFormulaire.category || ''}
            onChange={(values, updatedSousCaracs) => {
              // ✅ NOUVEAU 2025-11-04: Mettre à jour aussi sous-caractéristiques si modifiées
              if (updatedSousCaracs) {
                handleFieldChange(field.name, {
                  type_donnee: 'autocomplete',
                  valeur: values,
                  separateur: safeSeparateur, // ✅ Utiliser safeSeparateur
                  sous_caracteristiques: updatedSousCaracs,
                  identifiant_base: field.identifiantBase || field.name,
                  filtrable: field.filtrable !== false,
                  origine_champs: 'formulaire'
                });
              } else {
                // Même si pas de mise à jour de sous-caracs, garder la structure complète
                handleFieldChange(field.name, {
                  type_donnee: 'autocomplete',
                  valeur: values,
                  separateur: safeSeparateur, // ✅ Utiliser safeSeparateur
                  sous_caracteristiques: currentSousCaracs, // Garder les sous-caracs existantes
                  identifiant_base: field.identifiantBase || field.name,
                  filtrable: field.filtrable !== false,
                  origine_champs: 'formulaire'
                });
              }
            }}
            required={field.required}
            // ✅ CORRECTION 2025-11-05: Ne PAS passer placeholder pour utiliser la génération dynamique interne
            // Le LinearAutocompleteEditor génère automatiquement un placeholder basé sur value[0] (combinaison IA)
            allowCustomModality={field.allowCustomModality !== false}
            filtrable={field.filtrable !== false}
          />
          {fieldErrors[field.name] && (
            <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors[field.name])}</Text>
          )}
        </View>
      );
    }

    if (field.typeDonnee === 'price_variant') {
      const iaModalites = Array.isArray(field.modalites) ? field.modalites : [];
      const userModalites = valeursFormulaire[field.name]?.modalites;
      const modalitesFromUser = Array.isArray(userModalites) ? userModalites : [];
      const modalitesToRender = modalitesFromUser.length > 0 ? modalitesFromUser : iaModalites;

      if (!Array.isArray(modalitesToRender) || modalitesToRender.length === 0) {
        return null;
      }

      const typeOffre = (valeursFormulaire.type_offre || 'produit').toLowerCase();
      const isProduitPhysique = typeOffre === 'produit' || typeOffre === 'vente';

      return (
        <View key={field.name} style={styles.fieldContainer}>
          <PriceVariantSelector
            label={field.label || (isProduitPhysique ? 'Variantes produit' : 'Variantes prestation')}
            variable={field.variable || (isProduitPhysique ? 'option' : 'formule')}
            modalites={modalitesToRender}
            onChange={(modalites) => {
              handleFieldChange(field.name, {
                type_donnee: 'price_variant',
                variable: field.variable || (isProduitPhysique ? 'option' : 'formule'),
                modalites,
                filtrable: field.filtrable !== false,
                origine_champs: 'formulaire'
              });
            }}
            required={field.required}
            availableCurrencies={['XAF', 'EUR', 'USD']}
            defaultCurrency={valeursFormulaire.devise_produit || valeursFormulaire.devise || 'XAF'}
            helperText="Modifiez les options détectées par l'IA (prix, stock, image)."
            showEmptyStateDetails={modalitesToRender.length === 0}
          />
          {fieldErrors[field.name] && (
            <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors[field.name])}</Text>
          )}
        </View>
      );
    }

    if (field.typeDonnee === 'date') {
      return (
        <View key={field.name} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            {field.label} {field.required && <Text style={styles.required}>*</Text>}
          </Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => {
              // Utiliser le sélecteur de date natif
              const currentDate = valeursFormulaire[field.name] || new Date().toISOString().split('T')[0];
              Alert.prompt(
                'Sélectionner une date',
                'Format: YYYY-MM-DD',
                [
                  {
                    text: 'Annuler',
                    style: 'cancel'
                  },
                  {
                    text: 'OK',
                    onPress: (dateStr) => {
                      if (dateStr) {
                        // Valider le format YYYY-MM-DD
                        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                        if (dateRegex.test(dateStr)) {
                          handleFieldChange(field.name, dateStr);
                        } else {
                          Alert.alert('Erreur', 'Format de date invalide. Utilisez YYYY-MM-DD (ex: 2024-12-25)');
                        }
                      }
                    }
                  }
                ],
                'plain-text',
                currentDate
              );
            }}
            disabled={isReadonly}
          >
            <Text style={styles.pickerButtonText}>
              {valeursFormulaire[field.name] || field.placeholder || 'Sélectionner une date (YYYY-MM-DD)'}
            </Text>
            <SafeIcon name="calendar" size={16} color="#666" />
          </TouchableOpacity>
          {fieldErrors[field.name] && (
            <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors[field.name])}</Text>
          )}
        </View>
      );
    }

    if (field.typeDonnee === 'location') {
      return (
        <View key={field.name} style={styles.fieldContainer}>
          <LocationSelector
            label={field.label}
            value={valeursFormulaire[field.name]?.valeur || valeursFormulaire[field.name] || ''}
            onSelect={(selectedLocation) => {
              handleFieldChange(field.name, {
                type_donnee: 'location',
                valeur: selectedLocation,
                composants: {
                  // On pourrait enrichir avec des composants si besoin
                  lieu: selectedLocation
                },
                filtrable: true,
                origine_champs: 'formulaire'
              });
            }}
            placeholder={field.placeholder || 'Rechercher ville, quartier, pays, région...'}
            scope="all" // ✅ CORRECTION 2025-11-05: Recherche universelle (ville, quartier, pays, région)
            required={field.required}
            enrichWithBackend={true} // ✅ Activer enrichissement GeoNames pour tous les champs location
          />
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              💡 <Text style={styles.hintBold}>Recherche géographique intelligente :</Text> Vous pouvez rechercher des quartiers (ex: Bonanjo, Akwa), villes (ex: Douala, Yaoundé), pays (ex: Cameroun) ou régions (ex: Afrique Centrale). Le système gère automatiquement tous les niveaux géographiques.
            </Text>
          </View>
          {field.composants && Object.keys(field.composants).length > 0 && field.name !== 'lieu_produit' && (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                💡 Composants disponibles: {Object.keys(field.composants).join(', ')}
              </Text>
            </View>
          )}
          {fieldErrors[field.name] && (
            <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors[field.name])}</Text>
          )}
        </View>
      );
    }

    if (field.name === '_media_manager' || field.name === '_branding_manager') {
      return (
        <View key={field.name} style={styles.fieldContainer}>
          <BrandingManagerMobile
            logo={mediaFiles.logo || []}
            banner={mediaFiles.banner || []}
            onLogoChange={updateBrandLogo}
            onBannerChange={updateBrandBanner}
            readonly={isReadonly}
          />
        </View>
      );
    }


    // ✅ NOUVEAU: Gestionnaire de mode de paiement
    if (field.name === '_payment_manager') {
      return (
        <View key={field.name}>
          <PaymentMethodSelector
            onPaymentChange={setPaymentMethod}
            readonly={isReadonly}
          />
        </View>
      );
    }

    // ✅ NOUVEAU 2025-11-02: Gestionnaire de média produit avec upload complet
    if (field.name === '_product_media_manager') {
      return (
        <View key={field.name} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{field.label || '📸 Médias du produit'}</Text>
          <Text style={styles.helperText}>
            Ajoutez des photos et vidéos pour illustrer votre produit/prestation
          </Text>
          <MediaUploadManager
            images={mediaFiles.images}
            videos={mediaFiles.videos}
            onImagesChange={updateProductImages}
            onVideosChange={updateProductVideos}
            readonly={isReadonly}
            maxImages={MAX_PRODUCT_IMAGES}
            maxVideos={3}
            onHorizontalScrollStart={handleMediaHorizontalScrollStart}
            onHorizontalScrollEnd={handleMediaHorizontalScrollEnd}
          />
        </View>
      );
    }

    // Champ GPS fixe personnalisé
    if (field.name === 'gps_fixe') {
      return (
        <View key={field.name} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            🎯 Position GPS fixe {field.required && <Text style={styles.required}>*</Text>}
          </Text>

          <TouchableOpacity
            style={styles.gpsButton}
            onPress={() => isReadonly ? null : setShowGPSModal(true)}
            disabled={isReadonly}
          >
            <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
            <Text style={styles.gpsButtonText}>
              {valeursFormulaire.gps_fixe ? 'Modifier la position' : 'Sélectionner une position'}
            </Text>
          </TouchableOpacity>

          {valeursFormulaire.gps_fixe && (
            <View style={styles.gpsInfoCard}>
              <SafeIcon name="check-circle" size={14} color={modernColors.success} />
              <Text style={styles.gpsInfoText}>
                Position enregistrée : {valeursFormulaire.gps_fixe.includes('|')
                  ? `Zone avec ${valeursFormulaire.gps_fixe.split('|').length} points`
                  : valeursFormulaire.gps_fixe}
              </Text>
            </View>
          )}

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              💡 <Text style={styles.hintBold}>Conseil :</Text> Renseignez ce champ si votre service est basé dans un lieu fixe (boutique, bureau, atelier). Vous pouvez sélectionner un point ou dessiner une zone.
            </Text>
          </View>
        </View>
      );
    }


    // Champs standards
    switch (field.type) {
      case 'select':
      case 'dropdown':
        // ✅ AMÉLIORATION: Utiliser ProductFieldSelector qui détecte automatiquement le type de sélection
        const productType = valeursFormulaire.category || 'autre';

        return (
          <View key={field.name} style={styles.fieldContainer}>
            <ProductFieldSelector
              label={field.label}
              fieldName={field.name}
              productType={productType}
              value={valeursFormulaire[field.name] || (field.multiSelect ? [] : '')}
              onSelect={(value) => {
                handleFieldChange(field.name, value);
                // Effacer l'erreur quand l'utilisateur sélectionne une valeur
                if (fieldErrors[field.name]) {
                  setFieldErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[field.name];
                    return newErrors;
                  });
                }
              }}
              required={field.required}
              multiSelect={field.multiSelect || field.allowMultiple}
              maxSelections={field.maxSelections || 20}
              placeholder={field.placeholder || 'Sélectionner...'}
              customOptions={field.options} // ✅ NOUVEAU: Passer les options personnalisées
            />
            {fieldErrors[field.name] && (
              <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors[field.name])}</Text>
            )}
          </View>
        );

      case 'text':
      case 'email':
      case 'url':
        const hasError = fieldErrors[field.name];
        const isProductField = ['nom_produit', 'categorie_produit'].includes(field.name);

        return (
          <View key={field.name} style={isProductField ? styles.productFieldContainer : styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <NativeInput
              placeholder={field.placeholder}
              value={valeursFormulaire[field.name] || ''}
              onChangeText={(text) => {
                handleFieldChange(field.name, text);
                // Effacer l'erreur quand l'utilisateur tape
                if (hasError) {
                  setFieldErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[field.name];
                    return newErrors;
                  });
                }
              }}
              style={[
                styles.fieldInput,
                hasError && styles.fieldInputError,
                styles.autoGrowingInput,
                field.name === 'nom_produit' && styles.autoGrowingInputName,
                field.name === 'categorie_produit' && styles.autoGrowingInputCategory
              ]}
            />
            {hasError && (
              <Text style={styles.fieldErrorText}>⚠️ {String(hasError)}</Text>
            )}
          </View>
        );
      case 'textarea':
        const isProductDescField = field.name === 'description_produit';
        const linesMinimum = isProductDescField ? 8 : 3;
        const normalizedValue = formatMultilineValue(valeursFormulaire[field.name] || '');
        return (
          <View key={field.name} style={isProductDescField ? styles.productFieldContainer : styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <NativeInput
              placeholder={field.placeholder}
              value={normalizedValue}
              onChangeText={(text) => handleFieldChange(field.name, text.replace(/\r/g, ''))}
              multiline
              minLines={linesMinimum}
              inputStyle={isProductDescField ? styles.productDescriptionText : undefined}
              onContentSizeChange={(width, height) => {
                const lineHeight = 24;
                const computedLines = Math.max(linesMinimum, Math.ceil(height / lineHeight));
                setDynamicTextareaHeights(prev => ({
                  ...prev,
                  [field.name]: computedLines * lineHeight + 32
                }));
              }}
              style={[
                styles.fieldInput,
                styles.textareaInput,
                isProductDescField && styles.productDescriptionInput,
                dynamicTextareaHeights[field.name] ? { minHeight: dynamicTextareaHeights[field.name] } : null
              ]}
            />
          </View>
        );
      case 'number':
        // ✅ Cas spécial : Prix et Devise sur la même ligne
        if (field.name === 'prix') {
          return (
            <View key={field.name} style={styles.fieldRow}>
              <View style={[styles.fieldContainer, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>
                  {field.label} {field.required && <Text style={styles.required}>*</Text>}
                </Text>
                <NativeInput
                  placeholder={field.placeholder}
                  value={valeursFormulaire[field.name]?.toString() || ''}
                  onChangeText={(text) => handleFieldChange(field.name, text)}
                  keyboardType="numeric"
                  style={styles.fieldInput}
                />
              </View>
              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Devise</Text>
                <View style={styles.readonlyCurrencyChip}>
                  <SafeIcon name="info" size={14} color="#0F172A" />
                  <Text style={styles.readonlyCurrencyText}>
                    {(valeursFormulaire.devise || deviseProduitValue || 'Auto')} (déterminée automatiquement)
                  </Text>
                </View>
              </View>
            </View>
          );
        }

        // Autres champs number
        return (
          <View key={field.name} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <NativeInput
              placeholder={field.placeholder}
              value={valeursFormulaire[field.name]?.toString() || ''}
              onChangeText={(text) => handleFieldChange(field.name, text)}
              keyboardType="numeric"
              style={styles.fieldInput}
            />
          </View>
        );
      case 'boolean':
      case 'checkbox':
        // Champ is_tarissable en lecture seule (récupéré du backend)
        if (field.name === 'is_tarissable') {
          return (
            <View key={field.name} style={styles.fieldContainer}>
              <View style={styles.readonlyCheckboxContainer}>
                <View style={[
                  styles.checkbox,
                  valeursFormulaire[field.name] && styles.checkboxChecked
                ]}>
                  {valeursFormulaire[field.name] && (
                    <SafeIcon name="check" size={16} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.readonlyLabelContainer}>
                  <Text style={styles.checkboxLabel}>
                    {field.label} {field.required && <Text style={styles.required}>*</Text>}
                  </Text>
                </View>
              </View>
            </View>
          );
        }

        // Autres champs checkbox éditables
        return (
          <View key={field.name} style={styles.fieldContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleFieldChange(field.name, !valeursFormulaire[field.name])}
              disabled={isReadonly}
            >
              <View style={[
                styles.checkbox,
                valeursFormulaire[field.name] && styles.checkboxChecked
              ]}>
                {valeursFormulaire[field.name] && (
                  <SafeIcon name="check" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                {field.label} {field.required && <Text style={styles.required}>*</Text>}
              </Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  // ✅ NOUVEAU 2025-11-01: Fonction de gestion d'erreurs API améliorée (Objectif #10)
  const handleAPIError = (error: any, operation: string, retryFn?: () => void) => {
    console.error(`[${operation}]`, error);

    let title = `❌ Erreur - ${operation}`;
    let message = 'Une erreur inattendue est survenue';

    if (error.response) {
      // Erreur HTTP avec réponse du serveur
      switch (error.response.status) {
        case 400:
          title = '⚠️ Données invalides';
          message = error.response.data?.message || error.response.data?.error || 'Vérifiez les données saisies';
          break;
        case 401:
          title = '🔐 Non autorisé';
          message = 'Votre session a expiré. Veuillez vous reconnecter.';
          break;
        case 402:
          title = '💳 Solde insuffisant';
          message = error.response.data?.message || 'Rechargez votre compte pour continuer.\n\nRendez-vous dans "Recharger" pour ajouter des crédits.';
          break;
        case 404:
          title = '🔍 Non trouvé';
          message = 'La ressource demandée n\'existe pas ou a été supprimée.';
          break;
        case 413:
          title = '📦 Fichiers trop volumineux';
          message = 'Les médias sont trop volumineux. Réduisez la taille des images/vidéos.';
          break;
        case 500:
          title = '⚙️ Erreur serveur';
          message = 'Le serveur rencontre un problème temporaire. Réessayez dans quelques instants.';
          break;
        case 503:
          title = '🔧 Service indisponible';
          message = 'Le service est temporairement indisponible. Réessayez plus tard.';
          break;
        default:
          message = error.response.data?.message || error.response.data?.error || error.response.statusText || message;
      }
    } else if (error.request) {
      // Pas de réponse du serveur (problème réseau)
      title = '📡 Pas de connexion';
      message = 'Impossible de contacter le serveur.\n\nVérifiez votre connexion internet et réessayez.';
    } else if (error.message) {
      // Autre type d'erreur
      message = error.message;
    }

    const buttons: any[] = [{ text: 'OK' }];

    if (retryFn) {
      buttons.push({
        text: '🔄 Réessayer',
        onPress: retryFn
      });
    }

    Alert.alert(title, message, buttons);
  };

  // Fonction de validation des champs obligatoires
  const validateRequiredFields = () => {
    const errors: string[] = [];

    composants.forEach(field => {
      if (field.required) {
        const valeur = valeursFormulaire[field.name];

        if (!valeur || (typeof valeur === 'string' && valeur.trim() === '')) {
          const label = field.label || field.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          errors.push(`${label} est obligatoire`);
        }
      }
    });

    return errors;
  };

  // Soumettre le formulaire
  const soumettreFormulaire = async () => {
    // ✅ Protection contre double soumission
    if (loading || isSubmitting) {
      console.log('[FormulaireYukpoIntelligentScreen] ⚠️ Soumission déjà en cours, ignorée');
      return;
    }

    // Validation des champs obligatoires avant soumission
    const validationErrors = validateRequiredFields();
    if (validationErrors.length > 0) {
      Alert.alert(
        '⚠️ Champs obligatoires manquants',
        `Veuillez remplir les champs obligatoires :\n\n${validationErrors.join('\n')}`,
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setLoading(true);
      setIsSubmitting(true);
      console.log('[FormulaireYukpoIntelligentScreen] Soumission du formulaire...', { mode, serviceId });

      let compressedMediaCache: any = null;
      const getCompressedMedia = async () => {
        if (!compressedMediaCache) {
          const { compressAllMedia } = await import('../utils/mediaCompression');
          compressedMediaCache = await compressAllMedia(mediaFiles);
        }
        return compressedMediaCache;
      };

      const mergeMediaArrays = (existing: any, incoming: any): any[] => {
        const base = Array.isArray(incoming) ? incoming : [];
        const current = Array.isArray(existing) ? existing : [];
        const merged = [...base, ...current];
        const unique = merged.filter(Boolean).filter((value, index, self) => self.indexOf(value) === index);
        return unique;
      };

      const ensurePrimaryMediaForFirstProduct = (
        produitsNode: any,
        media: any,
        options: {
          nomFallback?: string;
          deviseFallback?: string;
          combinationString?: string;
          characteristicVector?: string[];
          productLabels?: string[];
          origineChamps?: string;
        } = {}
      ) => {
        if (!media?.images?.length) {
          return produitsNode;
        }

        try {
          const safeOptions =
            options && typeof options === 'object' && !Array.isArray(options)
              ? options
              : {};

          const readOption = (key: string) => {
            if (!safeOptions || typeof safeOptions !== 'object') {
              return undefined;
            }

            try {
              if (Object.prototype.hasOwnProperty.call(safeOptions, key)) {
                return (safeOptions as any)[key];
              }

              if (typeof (safeOptions as any).get === 'function') {
                return (safeOptions as any).get(key);
              }

              return (safeOptions as any)[key];
            } catch (error) {
              console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Lecture option impossible:', key, error);
              return undefined;
            }
          };

          const nomFallback =
            typeof readOption('nomFallback') === 'string'
              ? (readOption('nomFallback') as string)
              : '';

          const deviseFallbackCandidate =
            typeof readOption('deviseFallback') === 'string'
              ? (readOption('deviseFallback') as string).trim()
              : '';
          const deviseFallback =
            deviseFallbackCandidate.length > 0 ? deviseFallbackCandidate : 'XAF';

          const combinationString =
            typeof readOption('combinationString') === 'string'
              ? (readOption('combinationString') as string)
              : '';

          const characteristicVector: string[] = Array.isArray(
            readOption('characteristicVector')
          )
            ? (readOption('characteristicVector') as any[])
              .map((entry: any) =>
                typeof entry === 'string' ? entry.trim() : ''
              )
              .filter((entry: string) => entry.length > 0)
            : [];

          const productLabels: string[] = Array.isArray(
            readOption('productLabels')
          )
            ? (readOption('productLabels') as any[])
              .map((entry: any) =>
                typeof entry === 'string' ? entry.trim() : ''
              )
              .filter((entry: string) => entry.length > 0)
            : [];

          const origineChamps =
            typeof readOption('origineChamps') === 'string' &&
              (readOption('origineChamps') as string).trim().length > 0
              ? (readOption('origineChamps') as string).trim()
              : 'formulaire';

          const buildBaseProduct = () => ({
            nom: nomFallback,
            images: [...media.images],
            base64_image: [...media.images],
            videos: media.videos ? [...media.videos] : undefined,
            video_base64: media.videos ? [...media.videos] : undefined,
            audio_base64: media.audios ? [...media.audios] : undefined,
            doc_base64: media.documents ? [...media.documents] : undefined,
            excel_base64: media.excel ? [...media.excel] : undefined,
            devise: deviseFallback,
            combinaison_brute: combinationString,
            characteristic_vector: [...characteristicVector],
            product_labels: [...productLabels],
            origine_champs: origineChamps,
          });

          if (!produitsNode) {
            return {
              type_donnee: 'listeproduit',
              valeur: [buildBaseProduct()],
              origine_champs: origineChamps,
              characteristic_vector: [...characteristicVector],
              product_labels: [...productLabels],
              combinaison_brute: combinationString,
            } as any;
          }

          if (produitsNode.type_donnee === 'listeproduit') {
            const produitsArray = Array.isArray(produitsNode.valeur)
              ? [...produitsNode.valeur]
              : [];
            if (produitsArray.length === 0) {
              produitsArray.push(buildBaseProduct());
            } else {
              const firstProduct: any = { ...produitsArray[0] };
              const existingImages = Array.isArray(firstProduct.images)
                ? firstProduct.images.filter(Boolean)
                : [];
              const newImages = Array.isArray(media.images)
                ? media.images.filter(Boolean)
                : [];
              const mergedImages = [...newImages, ...existingImages].filter((value, index, self) => self.indexOf(value) === index);
              if (mergedImages.length > 0) {
                firstProduct.images = mergedImages;
                firstProduct.base64_image = mergedImages;
              }

              if (media.videos?.length) {
                const mergedVideos = mergeMediaArrays(
                  firstProduct.videos,
                  media.videos
                );
                if (mergedVideos.length > 0) {
                  firstProduct.videos = mergedVideos;
                  firstProduct.video_base64 = mergedVideos;
                }
              }

              if (media.audios?.length) {
                const mergedAudios = mergeMediaArrays(
                  firstProduct.audio_base64,
                  media.audios
                );
                if (mergedAudios.length > 0) {
                  firstProduct.audio_base64 = mergedAudios;
                }
              }

              if (media.documents?.length) {
                const mergedDocs = mergeMediaArrays(
                  firstProduct.doc_base64,
                  media.documents
                );
                if (mergedDocs.length > 0) {
                  firstProduct.doc_base64 = mergedDocs;
                }
              }

              if (media.excel?.length) {
                const mergedExcel = mergeMediaArrays(
                  firstProduct.excel_base64,
                  media.excel
                );
                if (mergedExcel.length > 0) {
                  firstProduct.excel_base64 = mergedExcel;
                }
              }

              if (!firstProduct.nom) {
                firstProduct.nom = nomFallback;
              }
              if (!firstProduct.devise) {
                firstProduct.devise = deviseFallback;
              }

              if (combinationString && !firstProduct.combinaison_brute) {
                firstProduct.combinaison_brute = combinationString;
              }

              if (
                characteristicVector.length &&
                (!Array.isArray(firstProduct.characteristic_vector) ||
                  firstProduct.characteristic_vector.length === 0)
              ) {
                firstProduct.characteristic_vector = [...characteristicVector];
              }

              if (
                productLabels.length &&
                (!Array.isArray(firstProduct.product_labels) ||
                  firstProduct.product_labels.length === 0)
              ) {
                firstProduct.product_labels = [...productLabels];
              }

              if (!firstProduct.origine_champs) {
                firstProduct.origine_champs = origineChamps;
              }

              produitsArray[0] = firstProduct;
            }

            return {
              ...produitsNode,
              valeur: produitsArray,
              origine_champs: produitsNode.origine_champs || origineChamps,
              characteristic_vector:
                produitsNode.characteristic_vector || [...characteristicVector],
              product_labels:
                produitsNode.product_labels || [...productLabels],
              combinaison_brute:
                produitsNode.combinaison_brute || combinationString,
            };
          }

          return produitsNode;
        } catch (error) {
          console.error(
            '[FormulaireYukpoIntelligentScreen] ⚠️ ensurePrimaryMediaForFirstProduct a échoué',
            {
              error,
              hasMediaImages: !!media?.images?.length,
              optionsType: typeof options,
            }
          );
          return produitsNode;
        }
      };

      // ✅ SI MODE DUPLICATION PRODUIT (ancienne fonctionnalité)
      if (isAddingProduct && serviceId) {
        console.log('[FormulaireYukpoIntelligentScreen] 🛍️ MODE DUPLICATION - Ajout produit au service', serviceId);

        // ✅ CORRECTION 2025-11-06: Construire les données COMPLÈTES du nouveau produit
        // Inclure TOUS les champs produits + médias (images, vidéos, prix variant, etc.)
        const nouveauProduit: any = {};

        // Champs du bloc produits à extraire
        const PRODUCT_FIELDS = [
          'nom_produit',
          'categorie_produit',
          'description_produit',
          'produits',
          'prix',
          'prix_produit',
          'devise',
          'lieu_produit',
          'lieu_commercial',
          'lieu_commercialisation',
          'price_variant',   // ✅ NOUVEAU : Variations de prix
          'variabilite_prix', // Alias de price_variant
          'product_labels',   // ✅ NOUVEAU : Labels/tags
          'images',           // ✅ NOUVEAU : Images produit
          'videos',           // ✅ NOUVEAU : Vidéos produit
          'audios',           // Éventuellement
          'documents'         // Éventuellement
        ];

        PRODUCT_FIELDS.forEach(key => {
          const value = valeursFormulaire[key];
          if (value !== undefined && value !== null && value !== '') {
            nouveauProduit[key] = value;
          }
        });

        const compressedMedia = await getCompressedMedia();

        if (compressedMedia?.images?.length) {
          const mergedImages = mergeMediaArrays(nouveauProduit.images, compressedMedia.images);
          if (mergedImages.length > 0) {
            nouveauProduit.images = mergedImages;
            nouveauProduit.base64_image = mergedImages;
          }
        }

        if (compressedMedia?.videos?.length) {
          const mergedVideos = mergeMediaArrays(nouveauProduit.videos, compressedMedia.videos);
          if (mergedVideos.length > 0) {
            nouveauProduit.videos = mergedVideos;
            nouveauProduit.video_base64 = mergedVideos;
          }
        }

        if (compressedMedia?.audios?.length) {
          const mergedAudios = mergeMediaArrays(nouveauProduit.audio_base64, compressedMedia.audios);
          if (mergedAudios.length > 0) {
            nouveauProduit.audio_base64 = mergedAudios;
          }
        }

        if (compressedMedia?.documents?.length) {
          const mergedDocs = mergeMediaArrays(nouveauProduit.doc_base64, compressedMedia.documents);
          if (mergedDocs.length > 0) {
            nouveauProduit.doc_base64 = mergedDocs;
          }
        }

        if (compressedMedia?.excel?.length) {
          const mergedExcel = mergeMediaArrays(nouveauProduit.excel_base64, compressedMedia.excel);
          if (mergedExcel.length > 0) {
            nouveauProduit.excel_base64 = mergedExcel;
          }
        }

        console.log('[FormulaireYukpoIntelligentScreen] 📦 Données du nouveau produit (complètes):', {
          ...nouveauProduit,
          images: compressedMedia?.images?.length || 0,
          videos: compressedMedia?.videos?.length || 0
        });

        // 💰 ÉTAPE 1 : Vérifier le solde (coût fixe : 3000 FCFA pour ajout produit)
        const COUT_AJOUT_PRODUIT = 3000;

        console.log('💰 [FormulaireYukpoIntelligentScreen] Vérification du solde pour ajout produit...');
        const balanceResponse = await apiGet<{ tokens_balance: number }>('/api/users/balance');

        if (!balanceResponse.success) {
          const errorMsg = balanceResponse.error || 'Impossible de vérifier votre solde';
          console.error('💰 [FormulaireYukpoIntelligentScreen] ❌ Erreur vérification solde:', errorMsg);

          // Si problème d'authentification, rediriger vers login
          if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('authentification')) {
            Alert.alert(
              'Session expirée',
              'Votre session a expiré. Veuillez vous reconnecter.',
              [{ text: 'OK', onPress: () => logout() }]
            );
            return;
          }

          throw new Error(errorMsg);
        }

        if (!balanceResponse.data || typeof balanceResponse.data.tokens_balance === 'undefined') {
          console.error('💰 [FormulaireYukpoIntelligentScreen] ❌ Données solde invalides:', balanceResponse.data);
          throw new Error('Données de solde invalides reçues du serveur');
        }

        const soldeActuel = balanceResponse.data.tokens_balance || 0;
        console.log('💰 [FormulaireYukpoIntelligentScreen] ✅ Solde actuel récupéré:', soldeActuel);

        // Vérifier si le solde est suffisant
        if (soldeActuel < COUT_AJOUT_PRODUIT) {
          Alert.alert(
            '💸 Solde insuffisant',
            `Coût d'ajout de produit : ${COUT_AJOUT_PRODUIT.toLocaleString()} FCFA\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\n\nVeuillez recharger votre compte pour ajouter ce produit.`,
            [{ text: 'OK' }]
          );
          return; // ❌ BLOQUE si solde insuffisant
        }

        // 💰 ÉTAPE 2 : Demander confirmation avec affichage du coût
        Alert.alert(
          '💰 Ajout de produit',
          `Coût : ${COUT_AJOUT_PRODUIT.toLocaleString()} FCFA\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\nSolde après ajout : ${(soldeActuel - COUT_AJOUT_PRODUIT).toLocaleString()} FCFA\n\nConfirmez-vous l'ajout de ce produit à votre service ?`,
          [
            {
              text: 'Annuler',
              style: 'cancel'
            },
            {
              text: 'Confirmer',
              onPress: async () => {
                try {
                  // Appeler /api/services/{serviceId}/products
                  const userId = parseInt(user?.id || '0', 10);
                  const response = await apiPost(`/api/services/${serviceId}/products`, {
                    user_id: userId,
                    product_data: nouveauProduit
                  });

                  if (!response.success) {
                    throw new Error(response.error || 'Erreur lors de l\'ajout du produit');
                  }

                  console.log('[FormulaireYukpoIntelligentScreen] ✅ Produit ajouté avec succès:', response);

                  const responseData: any = response.data ?? {};
                  const costPaid = Number(responseData.cost ?? response.cost ?? COUT_AJOUT_PRODUIT);
                  const newBalanceValue = Number(
                    responseData.new_balance ?? response.new_balance ?? (soldeActuel - COUT_AJOUT_PRODUIT)
                  );
                  const productIndexResult =
                    responseData.product_index ??
                    response.product_index ??
                    (typeof responseData === 'object' && responseData.data
                      ? responseData.data.product_index
                      : undefined);

                  Alert.alert(
                    '✅ Produit créé',
                    `Votre nouveau produit a été ajouté au service avec succès !\n\n` +
                    `💰 Coût: ${costPaid.toLocaleString('fr-FR')} FCFA\n` +
                    `💳 Nouveau solde: ${newBalanceValue.toLocaleString('fr-FR')} FCFA\n` +
                    `📦 Index produit: ${productIndexResult ?? 'non communiqué'}`,
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          // Retour vers management du service
                          navigation.goBack();
                        }
                      }
                    ]
                  );
                } catch (error: any) {
                  handleAPIError(error, 'Ajout produit', () => soumettreFormulaire());
                }
              }
            }
          ]
        );

        return; // ✅ Sortir sans exécuter la logique de création de service
      }

      // ✅ SI MODE MODIFICATION (edit OU edit_service_info) : Pas d'appel IA, pas de coût
      if ((mode === 'edit' || isEditingServiceInfo) && serviceId) {
        console.log('[FormulaireYukpoIntelligentScreen] 📝 MODE MODIFICATION - Pas d\'appel IA', { mode, isEditingServiceInfo });

        // Construire les données de service directement depuis le formulaire
        const finalServiceData: any = {};

        // Transformer les valeurs du formulaire en structure attendue
        Object.keys(valeursFormulaire).forEach(key => {
          const value = valeursFormulaire[key];
          if (value !== undefined && value !== null && value !== '') {
            finalServiceData[key] = {
              type_donnee: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
              valeur: value,
              origine_champs: 'formulaire'
            };
          }
        });

        const compressedMedia = await getCompressedMedia();
        if (compressedMedia) {
          const attachMediaField = (fieldName: string, values: any[], options: { typeDonnee?: string; takeFirst?: boolean } = {}) => {
            if (!values || !Array.isArray(values)) {
              return;
            }

            const cleaned = values.filter(Boolean);
            if (cleaned.length === 0) {
              return;
            }

            const { typeDonnee = 'array', takeFirst = false } = options;
            const valeur = takeFirst ? cleaned[0] : cleaned;

            finalServiceData[fieldName] = {
              type_donnee: typeDonnee,
              valeur,
              origine_champs: 'formulaire'
            };
          };

          attachMediaField('base64_image', compressedMedia.images, { typeDonnee: 'media' });
          attachMediaField('video_base64', compressedMedia.videos, { typeDonnee: 'media' });
          attachMediaField('audio_base64', compressedMedia.audios, { typeDonnee: 'media' });
          attachMediaField('doc_base64', compressedMedia.documents, { typeDonnee: 'media' });
          attachMediaField('excel_base64', compressedMedia.excel, { typeDonnee: 'media' });
          attachMediaField('logo', compressedMedia.logo, { typeDonnee: 'image', takeFirst: true });
          attachMediaField('banner', compressedMedia.banner, { typeDonnee: 'image', takeFirst: true });
        }

        // ✅ NOUVEAU: Les produits sont maintenant gérés via les champs dynamiques (autocomplete, price_variant)
        // Ils sont déjà inclus dans finalServiceData via les valeurs du formulaire

        // Ajouter le GPS fixe si présent
        if (valeursFormulaire.gps_fixe) {
          finalServiceData.gps_fixe = {
            type_donnee: 'string',
            valeur: valeursFormulaire.gps_fixe,
            origine_champs: 'formulaire'
          };
        }

        // Préparer le payload de modification
        const userId = parseInt(user?.id || '0', 10);
        const updatePayload = {
          user_id: userId,
          data: finalServiceData
        };

        console.log('[FormulaireYukpoIntelligentScreen] 📝 Mise à jour du service:', serviceId);

        // Appeler l'API de mise à jour
        const response = await apiPost(`/api/services/${serviceId}/update`, updatePayload);

        if (!response.success) {
          throw new Error(response.error || 'Erreur lors de la modification');
        }

        // ✅ SUPPRIMÉ: Vérification tickets de voyage - Géré maintenant via les champs dynamiques

        // ✅ Succès modification (pas de coût)
        const successTitle = isEditingServiceInfo ? '✅ Informations mises à jour' : '✅ Service modifié';
        const successMessage = isEditingServiceInfo
          ? 'Les informations de votre service ont été mises à jour avec succès.\n\n✅ Modification gratuite - Aucun frais'
          : 'Votre service a été mis à jour avec succès.\n\n✅ Modification gratuite - Aucun frais';

        Alert.alert(
          successTitle,
          successMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                setSuccessData({ serviceId, cout: 0 });
                setShowSuccessToast(true);
                DeviceEventEmitter.emit('service:refresh');
                if (fromMesProduits || isEditingServiceInfo) {
                  // Retour vers Mes Produits
                  navigation.goBack();
                } else if (fromMesServices) {
                  (navigation as any).navigate('Main', { screen: 'Services' });
                } else {
                  navigation.goBack();
                }
              }
            }
          ]
        );

        return; // ✅ Sortir ici pour éviter le flux de création
      }

      // ✅ NOUVEAU 2025-11-01: SI MODE ADD_PRODUCT : Appeler route ajout produit incrémental
      if (isAddingProduct && serviceId) {
        console.log('[FormulaireYukpoIntelligentScreen] 📦 MODE ADD_PRODUCT - Ajout produit au service', serviceId);

        try {
          setIsSubmitting(true);

          // Construire les données du nouveau produit uniquement
          const nouveauProduit: Record<string, any> = {};

          // Champs produits principaux
          if (valeursFormulaire.nom_produit) nouveauProduit.nom = valeursFormulaire.nom_produit;
          if (valeursFormulaire.prix_produit) nouveauProduit.prix = valeursFormulaire.prix_produit;
          if (valeursFormulaire.devise_produit) nouveauProduit.devise = valeursFormulaire.devise_produit;
          if (valeursFormulaire.description_produit) nouveauProduit.description = valeursFormulaire.description_produit;
          if (valeursFormulaire.categorie_produit) nouveauProduit.categorie = valeursFormulaire.categorie_produit;

          // Copier tous les autres champs du formulaire qui concernent le produit
          Object.keys(valeursFormulaire).forEach(key => {
            if (key.includes('produit') || key === 'produits') {
              nouveauProduit[key] = valeursFormulaire[key];
            }
          });

          console.log('[FormulaireYukpoIntelligentScreen] 📦 Données du nouveau produit:', nouveauProduit);

          // ✅ Appel route POST /api/services/{serviceId}/products
          const userId = parseInt(user?.id || '0', 10);
          const response = await apiPost(`/api/services/${serviceId}/products`, {
            user_id: userId,
            product_data: nouveauProduit
          });

          if (!response.success) {
            throw new Error(response.error || 'Erreur ajout produit');
          }

          const { cost, new_balance, product_index } = response.data;

          console.log('[FormulaireYukpoIntelligentScreen] ✅ Produit ajouté avec succès:', {
            cost,
            new_balance,
            product_index
          });

          Alert.alert(
            '✅ Produit ajouté',
            `Votre produit a été ajouté avec succès au service.\n\n💰 Coût: ${cost.toLocaleString()} FCFA\n💳 Nouveau solde: ${new_balance.toLocaleString()} FCFA`,
            [
              {
                text: 'OK',
                onPress: () => {
                  setSuccessData({ serviceId, cout: cost });
                  setShowSuccessToast(true);
                  DeviceEventEmitter.emit('service:refresh');

                  if (fromMesProduits) {
                    (navigation as any).navigate('MesProduits');
                  } else if (fromMesServices) {
                    (navigation as any).navigate('Main', { screen: 'Services' });
                  } else {
                    navigation.goBack();
                  }
                }
              }
            ]
          );

          return; // ✅ Sortir ici
        } catch (error: any) {
          handleAPIError(error, 'Ajout produit', () => soumettreFormulaire());
          return;
        } finally {
          setIsSubmitting(false);
          setLoading(false);
        }
      }

      // ✅ MODE CRÉATION : Vérification solde + Coût (SANS appel IA - déjà fait lors de la génération du formulaire)
      console.log('[FormulaireYukpoIntelligentScreen] 🆕 MODE CRÉATION - Utilisation des données du formulaire');

      // ✅ CORRECTION 413: Compresser les médias AVANT l'envoi
      console.log('[FormulaireYukpoIntelligentScreen] 🔄 Compression des médias...');
      const compressedMedia = await getCompressedMedia();

      console.log('[FormulaireYukpoIntelligentScreen] ✅ Médias compressés:', {
        before: `${(compressedMedia.totalSizeBefore / (1024 * 1024)).toFixed(2)} MB`,
        after: `${(compressedMedia.totalSizeAfter / (1024 * 1024)).toFixed(2)} MB`,
        saved: `${((1 - compressedMedia.totalSizeAfter / compressedMedia.totalSizeBefore) * 100).toFixed(1)}%`
      });

      // ✅ NOUVEAU: Message informatif si payload volumineux
      const payloadSizeMB = compressedMedia.totalSizeAfter / (1024 * 1024);
      if (payloadSizeMB > 30) {
        const estimatedTime = Math.ceil((payloadSizeMB * 8) / 5 / 60); // Upload à 5 Mbps en minutes
        Alert.alert(
          '⏳ Upload en cours',
          `Votre service contient ${payloadSizeMB.toFixed(0)} MB de données (${compressedMedia.images.length} images, ${compressedMedia.videos.length} vidéos).\n\n` +
          `⏱️ Temps estimé : ${estimatedTime}-${estimatedTime + 2} minutes\n\n` +
          `✅ Ne fermez pas l'application pendant l'upload.`,
          [{ text: 'Compris, continuer' }]
        );
      }

      // 💰 ÉTAPE 1 : Récupérer le coût depuis la suggestion IA initiale (si disponible)
      // Le formulaire a déjà été généré par l'IA via genererSuggestionsService, donc on récupère le coût déjà calculé
      // Structure de suggestion depuis HomeScreen : { ...result.data, data: result.data.data }
      // result.data contient : tokens_consumed, ia_model_used, data, service_data, etc.
      const tokensIAExterne = suggestion?.tokens_consumed
        || suggestion?.tokens_used
        || suggestion?.tokens
        || suggestion?.service_data?.tokens_consumed
        || (suggestion?.data && typeof suggestion.data === 'object' && (suggestion.data.tokens_consumed || suggestion.data.tokens_used || suggestion.data.tokens))
        || 0; // Fallback : 0 si pas de tokens (sera calculé côté backend)

      console.log('[FormulaireYukpoIntelligentScreen] ✅ Tokens IA récupérés depuis suggestion initiale:', tokensIAExterne);
      console.log('[FormulaireYukpoIntelligentScreen] 📊 Structure suggestion:', {
        hasTokensConsumed: !!suggestion?.tokens_consumed,
        hasServiceData: !!suggestion?.service_data,
        hasData: !!suggestion?.data,
        suggestionKeys: suggestion ? Object.keys(suggestion) : []
      });

      // Si aucun token n'est disponible dans la suggestion, estimer basé sur la taille des données
      let tokensEstimes = tokensIAExterne;
      if (tokensEstimes === 0) {
        // Estimation basée sur la taille des données : ~1 token par 4 caractères + coût images
        const texteLength = JSON.stringify(valeursFormulaire).length;
        const imageCount = compressedMedia.images.length;
        tokensEstimes = Math.ceil(texteLength / 4) + (imageCount * 170); // ~170 tokens par image (GPT-4 Vision)
        console.log('[FormulaireYukpoIntelligentScreen] ⚠️ Aucun token trouvé dans suggestion, estimation:', tokensEstimes);
      }
      const coutTokenOpenAIFCFA = 0.004;
      // Utiliser tokensEstimes si tokensIAExterne est 0
      const tokensPourCalcul = tokensIAExterne > 0 ? tokensIAExterne : tokensEstimes;
      const coutReel = Math.round(tokensPourCalcul * coutTokenOpenAIFCFA * 100); // x100 pour création de service
      console.log('💰 [FormulaireYukpoIntelligentScreen] Coût RÉEL calculé:', coutReel, 'FCFA pour', tokensPourCalcul, 'tokens');

      // Vérifier le solde actuel
      // ✅ CORRIGÉ: Utilise apiGet avec nouvelle structure ApiResponse
      console.log('💰 [FormulaireYukpoIntelligentScreen] Vérification du solde...');
      console.log('💰 [FormulaireYukpoIntelligentScreen] Token actuel:', user?.token ? 'Présent' : 'ABSENT');

      const balanceResponse = await apiGet<{ tokens_balance: number }>('/api/users/balance');

      console.log('💰 [FormulaireYukpoIntelligentScreen] Réponse balance complète:', JSON.stringify(balanceResponse, null, 2));

      if (!balanceResponse.success) {
        const errorMsg = balanceResponse.error || 'Impossible de vérifier votre solde';
        console.error('💰 [FormulaireYukpoIntelligentScreen] ❌ Erreur vérification solde:', errorMsg);
        console.error('💰 [FormulaireYukpoIntelligentScreen] ❌ Data reçue:', balanceResponse.data);

        // Si problème d'authentification, rediriger vers login
        if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('authentification')) {
          Alert.alert(
            'Session expirée',
            'Votre session a expiré. Veuillez vous reconnecter.',
            [{ text: 'OK', onPress: () => logout() }]
          );
          return;
        }

        throw new Error(errorMsg);
      }

      if (!balanceResponse.data || typeof balanceResponse.data.tokens_balance === 'undefined') {
        console.error('💰 [FormulaireYukpoIntelligentScreen] ❌ Données solde invalides:', balanceResponse.data);
        throw new Error('Données de solde invalides reçues du serveur');
      }

      const soldeActuel = balanceResponse.data.tokens_balance || 0;
      console.log('💰 [FormulaireYukpoIntelligentScreen] ✅ Solde actuel récupéré:', soldeActuel);

      // Vérifier si le solde est suffisant
      if (soldeActuel < coutReel) {
        Alert.alert(
          '💸 Solde insuffisant',
          `Coût réel : ${coutReel.toLocaleString()} FCFA\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\n\nVeuillez recharger votre compte avant de créer ce service.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Demander confirmation avec le coût RÉEL
      Alert.alert(
        '💰 Création de service',
        `Coût réel : ${coutReel.toLocaleString()} FCFA\nTokens consommés : ${tokensPourCalcul.toLocaleString()}${tokensIAExterne === 0 ? ' (estimé)' : ''}\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\nSolde après création : ${(soldeActuel - coutReel).toLocaleString()} FCFA\n\nConfirmez-vous la création de ce service ?`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
            onPress: () => {
              setLoading(false); // ✅ Remettre loading à false si annulé
            }
          },
          {
            text: 'Confirmer',
            onPress: async () => {
              // ✅ Protection contre double-clic sur le bouton Confirmer
              if (isSubmitting) {
                console.log('[FormulaireYukpoIntelligentScreen] ⚠️ Création déjà en cours, ignorée');
                return;
              }

              try {
                setIsSubmitting(true);
                console.log('[FormulaireYukpoIntelligentScreen] Création du service en cours...');

                // 🔧 ÉTAPE 3 : Construire les données structurées directement depuis le formulaire
                // ✅ CORRECTION : Plus besoin d'appeler l'IA, on utilise directement les données du formulaire
                // Les données initiales sont déjà dans suggestion.data (depuis genererSuggestionsService)
                let finalServiceData: any = {};

                // Utiliser les données de la suggestion initiale si disponibles
                // Structure : suggestion.data contient les champs structurés (titre_service, category, etc.)
                if (suggestion?.data && typeof suggestion.data === 'object') {
                  // Copier la structure de la suggestion initiale (qui vient de l'IA)
                  finalServiceData = JSON.parse(JSON.stringify(suggestion.data));
                  console.log('[FormulaireYukpoIntelligentScreen] ✅ Structure initiale depuis suggestion.data:', Object.keys(finalServiceData));
                } else if (suggestion?.service_data?.data) {
                  // Fallback : utiliser service_data.data si disponible
                  finalServiceData = JSON.parse(JSON.stringify(suggestion.service_data.data));
                  console.log('[FormulaireYukpoIntelligentScreen] ✅ Structure depuis suggestion.service_data.data:', Object.keys(finalServiceData));
                } else {
                  console.log('[FormulaireYukpoIntelligentScreen] ⚠️ Aucune structure initiale trouvée, construction depuis formulaire uniquement');
                }

                // ✅ Mettre à jour avec les valeurs du formulaire (les vraies valeurs saisies par l'utilisateur)
                Object.keys(valeursFormulaire).forEach(key => {
                  const value = valeursFormulaire[key];
                  if (value !== undefined && value !== null && value !== '') {
                    // Si la valeur existe déjà et est un objet avec 'valeur', on met à jour
                    if (finalServiceData[key] && typeof finalServiceData[key] === 'object' && finalServiceData[key].valeur !== undefined) {
                      finalServiceData[key].valeur = value;
                    } else {
                      // Sinon, créer la structure complète
                      finalServiceData[key] = {
                        type_donnee: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
                        valeur: value,
                        origine_champs: 'formulaire'
                      };
                    }
                  }
                });
                console.log('[FormulaireYukpoIntelligentScreen] ✅ Données finales construites depuis le formulaire:', finalServiceData);

                // ✅ NOUVEAU: Les produits sont maintenant gérés via les champs dynamiques (autocomplete, price_variant)
                // Ils sont déjà inclus dans finalServiceData via les valeurs du formulaire
                const totalPayloadSize = JSON.stringify(finalServiceData).length;
                const payloadSizeMB = totalPayloadSize / (1024 * 1024);
                console.log(`[FormulaireYukpoIntelligentScreen] 📊 Taille payload: ${payloadSizeMB.toFixed(2)} MB`);

                // ✅ ALERTE si payload trop gros (> 100MB)
                if (payloadSizeMB > 100) {
                  console.warn(`[FormulaireYukpoIntelligentScreen] ⚠️ Payload très volumineux: ${payloadSizeMB.toFixed(2)} MB - Risque d'erreur 413`);
                  Alert.alert(
                    '⚠️ Données volumineuses',
                    `Votre service contient beaucoup de médias (${payloadSizeMB.toFixed(2)} MB).\n\nCela pourrait causer des problèmes d'envoi. Conseils :\n- Réduisez le nombre d'images\n- Raccourcissez les vidéos`,
                    [
                      { text: 'Annuler', style: 'cancel', onPress: () => { setIsSubmitting(false); setLoading(false); return; } },
                      { text: 'Continuer quand même', onPress: () => { /* Continue */ } }
                    ]
                  );
                  return;
                }

                // ✅ CORRECTION CRITIQUE : Ajouter le GPS fixe si présent (évite GPS Nigeria)
                if (valeursFormulaire.gps_fixe) {
                  finalServiceData.gps_fixe = {
                    type_donnee: 'string',
                    valeur: valeursFormulaire.gps_fixe,
                    origine_champs: 'formulaire'
                  };
                  console.log('[FormulaireYukpoIntelligentScreen] ✅ GPS FIXE ajouté:', valeursFormulaire.gps_fixe);
                } else {
                  console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ AUCUN GPS FIXE - Le service utilisera le GPS en temps réel!');
                }

                // 🔧 ÉTAPE 5 : Créer le service avec les données structurées par l'IA
                console.log('[FormulaireYukpoIntelligentScreen] Transmission tokens IA externe au backend:', tokensIAExterne);

                // ✅ CORRECTION : Utiliser /api/services/create comme dans le frontend
                // ⚠️ IMPORTANT : Le backend attend les données dans un champ "data"
                // ✅ CORRECTION CRITIQUE : Convertir user.id (string) en number pour le backend
                const userId = parseInt(user?.id || '0', 10);
                if (isNaN(userId) || userId === 0) {
                  throw new Error('ID utilisateur invalide');
                }

                // ✅ VÉRIFICATION : S'assurer que les champs obligatoires sont présents ET au bon format
                const champsObligatoires = ['titre_service', 'category', 'is_tarissable'];
                const champsObligatoiresOptionnels = ['description']; // Optionnel mais recommandé

                // Fonction helper pour normaliser un champ en format objet structuré
                const normaliserChamp = (champName: string, valeurParDefaut?: any) => {
                  if (!finalServiceData[champName]) {
                    if (valeurParDefaut !== undefined) {
                      finalServiceData[champName] = {
                        type_donnee: typeof valeurParDefaut === 'boolean' ? 'boolean' : typeof valeurParDefaut === 'number' ? 'number' : 'string',
                        valeur: valeurParDefaut,
                        origine_champs: 'formulaire'
                      };
                      console.log(`[FormulaireYukpoIntelligentScreen] ✅ ${champName} ajouté avec valeur par défaut:`, valeurParDefaut);
                      return true;
                    }
                    return false;
                  }

                  // Vérifier que le champ est au format objet attendu
                  const champ = finalServiceData[champName];
                  if (typeof champ !== 'object' || !champ.valeur || !champ.type_donnee || !champ.origine_champs) {
                    // Normaliser le champ s'il n'est pas au bon format
                    const valeur = typeof champ === 'object' && champ.valeur !== undefined ? champ.valeur : champ;
                    finalServiceData[champName] = {
                      type_donnee: typeof valeur === 'boolean' ? 'boolean' : typeof valeur === 'number' ? 'number' : 'string',
                      valeur: valeur,
                      origine_champs: typeof champ === 'object' && champ.origine_champs ? champ.origine_champs : 'formulaire'
                    };
                    console.log(`[FormulaireYukpoIntelligentScreen] ✅ ${champName} normalisé au format structuré`);
                  }
                  return true;
                };

                // Normaliser tous les champs obligatoires
                let champManquants: string[] = [];
                for (const champ of champsObligatoires) {
                  if (champ === 'is_tarissable') {
                    // is_tarissable par défaut à false si absent
                    if (!normaliserChamp(champ, false)) {
                      champManquants.push(champ);
                    }
                  } else {
                    if (!normaliserChamp(champ)) {
                      champManquants.push(champ);
                    }
                  }
                }

                // Normaliser les champs optionnels aussi
                for (const champ of champsObligatoiresOptionnels) {
                  normaliserChamp(champ);
                }

                if (champManquants.length > 0) {
                  console.error('[FormulaireYukpoIntelligentScreen] ❌ Champs obligatoires manquants:', champManquants);
                  console.error('[FormulaireYukpoIntelligentScreen] ❌ Données finales:', JSON.stringify(finalServiceData, null, 2));
                  Alert.alert(
                    'Erreur de validation',
                    `Les champs suivants sont manquants : ${champManquants.join(', ')}\n\nVeuillez réessayer.`,
                    [{ text: 'OK' }]
                  );
                  setIsSubmitting(false);
                  setLoading(false);
                  return;
                }

                console.log('[FormulaireYukpoIntelligentScreen] ✅ Tous les champs obligatoires sont présents et normalisés');

                // ✅ CORRECTION CRITIQUE : Ajouter tokens_ia_externe DANS data (pas à la racine)
                // Le backend cherche tokens_ia_externe dans le champ data après déballage
                if (tokensIAExterne) {
                  finalServiceData.tokens_ia_externe = tokensIAExterne;
                }

                // ✅ NOUVEAU: Ajouter le mode de paiement si présent
                if (paymentMethod) {
                  finalServiceData.mode_paiement = {
                    type_donnee: 'object',
                    valeur: paymentMethod,
                    origine_champs: 'formulaire'
                  };
                  console.log('[FormulaireYukpoIntelligentScreen] ✅ Mode de paiement ajouté:', paymentMethod);
                }

                const attachMediaField = (fieldName: string, values: any[], options: { typeDonnee?: string; takeFirst?: boolean } = {}) => {
                  if (!values || !Array.isArray(values)) {
                    return;
                  }

                  const cleaned = values.filter(Boolean);
                  if (cleaned.length === 0) {
                    return;
                  }

                  const { typeDonnee = 'array', takeFirst = false } = options;
                  const valeur = takeFirst ? cleaned[0] : cleaned;

                  finalServiceData[fieldName] = {
                    type_donnee: typeDonnee,
                    valeur,
                    origine_champs: 'formulaire'
                  };
                };

                if (compressedMedia) {
                  attachMediaField('base64_image', compressedMedia.images, { typeDonnee: 'media' });
                  attachMediaField('video_base64', compressedMedia.videos, { typeDonnee: 'media' });
                  attachMediaField('audio_base64', compressedMedia.audios, { typeDonnee: 'media' });
                  attachMediaField('doc_base64', compressedMedia.documents, { typeDonnee: 'media' });
                  attachMediaField('excel_base64', compressedMedia.excel, { typeDonnee: 'media' });
                  attachMediaField('logo', compressedMedia.logo, { typeDonnee: 'image', takeFirst: true });
                  attachMediaField('banner', compressedMedia.banner, { typeDonnee: 'image', takeFirst: true });
                }

                let combinationString = '';
                let characteristicVector: string[] = [];
                let productLabelsFromAutocomplete: string[] = [];
                let origineChampsForMedia: string | undefined =
                  typeof finalServiceData.produits?.origine_champs === 'string'
                    ? finalServiceData.produits.origine_champs
                    : undefined;

                // ✅ CRITIQUE 2025-11-02: Transformer autocomplete → listeproduit AVANT envoi
                if (finalServiceData.produits && finalServiceData.produits.type_donnee === 'autocomplete') {
                  console.log('[FormulaireYukpoIntelligentScreen] 🔄 Transformation autocomplete → listeproduit...');

                  const autocompleteData = finalServiceData.produits;

                  // Extraire les champs individuels du produit
                  const nomProduit = finalServiceData.nom_produit?.valeur || valeursFormulaire.nom_produit || '';
                  const prixProduit = finalServiceData.prix_produit?.valeur || valeursFormulaire.prix_produit || 0;
                  const categorieProduit = finalServiceData.categorie_produit?.valeur || valeursFormulaire.categorie_produit || '';
                  const descriptionProduit = finalServiceData.description_produit?.valeur || valeursFormulaire.description_produit || '';
                  const deviseProduit = finalServiceData.devise_produit?.valeur || valeursFormulaire.devise_produit || 'XAF';

                  combinationString = (() => {
                    if (Array.isArray(autocompleteData?.valeur)) {
                      const firstString = autocompleteData.valeur.find((entry: any) => typeof entry === 'string');
                      if (typeof firstString === 'string') {
                        return firstString;
                      }
                    }
                    if (typeof autocompleteData?.valeur === 'string') {
                      return autocompleteData.valeur;
                    }
                    if (Array.isArray(valeursFormulaire?.produits)) {
                      const firstString = valeursFormulaire.produits.find((entry: any) => typeof entry === 'string');
                      if (typeof firstString === 'string') {
                        return firstString;
                      }
                    }
                    if (typeof valeursFormulaire?.produits === 'string') {
                      return valeursFormulaire.produits;
                    }
                    return '';
                  })();

                  const effectiveSeparator = ((): string => {
                    if (typeof autocompleteData?.separateur === 'string' && autocompleteData.separateur.trim().length > 0) {
                      return autocompleteData.separateur;
                    }
                    if (typeof separateur === 'string' && separateur.trim().length > 0) {
                      return separateur;
                    }
                    return ',';
                  })();

                  characteristicVector = combinationString
                    ? combinationString.split(effectiveSeparator).map((part) => part.trim()).filter(Boolean)
                    : [];

                  productLabelsFromAutocomplete = (() => {
                    if (autocompleteData?.sous_caracteristiques && typeof autocompleteData.sous_caracteristiques === 'object') {
                      return Object.keys(autocompleteData.sous_caracteristiques || {});
                    }
                    if (Array.isArray(valeursFormulaire?.product_labels)) {
                      return valeursFormulaire.product_labels.filter((label: any) => typeof label === 'string');
                    }
                    return [];
                  })();

                  origineChampsForMedia = autocompleteData.origine_champs || 'formulaire';

                  // Construire l'objet produit enrichi des médias
                  const produitObj: any = {
                    nom: nomProduit,
                    prix: prixProduit,
                    categorie: categorieProduit,
                    description: descriptionProduit,
                    devise: deviseProduit,
                    combinaison_brute: combinationString,
                    characteristic_vector: characteristicVector,
                    product_labels: productLabelsFromAutocomplete,
                    origine_champs: autocompleteData.origine_champs || 'formulaire'
                  };

                  if (compressedMedia?.images?.length) {
                    const mergedImages = mergeMediaArrays(produitObj.images, compressedMedia.images);
                    if (mergedImages.length > 0) {
                      produitObj.images = mergedImages;
                      produitObj.base64_image = mergedImages;
                    }
                  }

                  if (compressedMedia?.videos?.length) {
                    const mergedVideos = mergeMediaArrays(produitObj.videos, compressedMedia.videos);
                    if (mergedVideos.length > 0) {
                      produitObj.videos = mergedVideos;
                      produitObj.video_base64 = mergedVideos;
                    }
                  }

                  if (compressedMedia?.audios?.length) {
                    const mergedAudios = mergeMediaArrays(produitObj.audio_base64, compressedMedia.audios);
                    if (mergedAudios.length > 0) {
                      produitObj.audio_base64 = mergedAudios;
                    }
                  }

                  if (compressedMedia?.documents?.length) {
                    const mergedDocs = mergeMediaArrays(produitObj.doc_base64, compressedMedia.documents);
                    if (mergedDocs.length > 0) {
                      produitObj.doc_base64 = mergedDocs;
                    }
                  }

                  if (compressedMedia?.excel?.length) {
                    const mergedExcel = mergeMediaArrays(produitObj.excel_base64, compressedMedia.excel);
                    if (mergedExcel.length > 0) {
                      produitObj.excel_base64 = mergedExcel;
                    }
                  }

                  // Transformer en listeproduit
                  finalServiceData.produits = {
                    type_donnee: 'listeproduit',
                    valeur: [produitObj],
                    origine_champs: autocompleteData.origine_champs || 'formulaire',
                    variation_prix: autocompleteData.variation_prix // Préserver variation_prix si existe
                  };

                  // Retirer les champs individuels (déjà dans listeproduit)
                  delete finalServiceData.nom_produit;
                  delete finalServiceData.prix_produit;
                  delete finalServiceData.categorie_produit;
                  delete finalServiceData.description_produit;
                  delete finalServiceData.devise_produit;

                  console.log('[FormulaireYukpoIntelligentScreen] ✅ Transformation réussie:', finalServiceData.produits);
                }

                if (finalServiceData.produits && finalServiceData.produits.type_donnee === 'listeproduit') {
                  const produitsNode = finalServiceData.produits;
                  const firstProduct =
                    Array.isArray(produitsNode.valeur) && produitsNode.valeur.length > 0
                      ? produitsNode.valeur[0]
                      : undefined;

                  if (!combinationString) {
                    if (typeof produitsNode.combinaison_brute === 'string') {
                      combinationString = produitsNode.combinaison_brute;
                    } else if (typeof firstProduct?.combinaison_brute === 'string') {
                      combinationString = firstProduct.combinaison_brute;
                    }
                  }

                  if (!characteristicVector.length) {
                    if (Array.isArray(produitsNode.characteristic_vector)) {
                      characteristicVector = produitsNode.characteristic_vector.filter(
                        (entry: any) => typeof entry === 'string' && entry.trim().length > 0
                      );
                    } else if (Array.isArray(firstProduct?.characteristic_vector)) {
                      characteristicVector = firstProduct.characteristic_vector.filter(
                        (entry: any) => typeof entry === 'string' && entry.trim().length > 0
                      );
                    }
                  }

                  if (!productLabelsFromAutocomplete.length) {
                    if (Array.isArray(produitsNode.product_labels)) {
                      productLabelsFromAutocomplete = produitsNode.product_labels.filter(
                        (entry: any) => typeof entry === 'string' && entry.trim().length > 0
                      );
                    } else if (Array.isArray(firstProduct?.product_labels)) {
                      productLabelsFromAutocomplete = firstProduct.product_labels.filter(
                        (entry: any) => typeof entry === 'string' && entry.trim().length > 0
                      );
                    }
                  }

                  if (!origineChampsForMedia) {
                    if (typeof produitsNode.origine_champs === 'string' && produitsNode.origine_champs.trim().length > 0) {
                      origineChampsForMedia = produitsNode.origine_champs.trim();
                    } else if (typeof firstProduct?.origine_champs === 'string' && firstProduct.origine_champs.trim().length > 0) {
                      origineChampsForMedia = firstProduct.origine_champs.trim();
                    }
                  }
                }

                finalServiceData.produits = ensurePrimaryMediaForFirstProduct(
                  finalServiceData.produits,
                  compressedMedia,
                  {
                    nomFallback: valeursFormulaire.nom_produit || finalServiceData.titre_service?.valeur || '',
                    deviseFallback: valeursFormulaire.devise_produit || valeursFormulaire.devise || 'XAF',
                    combinationString: combinationString,
                    characteristicVector: characteristicVector,
                    productLabels: productLabelsFromAutocomplete,
                    origineChamps: origineChampsForMedia || 'formulaire'
                  }
                );

                // Le backend attend : { user_id: number, data: {...} }
                const servicePayload = {
                  user_id: userId,
                  data: finalServiceData, // Les données avec tokens_ia_externe inclus
                };

                console.log('[FormulaireYukpoIntelligentScreen] ✅ Payload envoyé au backend:', JSON.stringify(servicePayload, null, 2));
                console.log('[FormulaireYukpoIntelligentScreen] 🔑 Token utilisé:', user?.token ? `${user.token.substring(0, 20)}...` : 'AUCUN TOKEN');
                console.log('[FormulaireYukpoIntelligentScreen] 👤 User ID:', user?.id);

                // ✅ CORRIGÉ: Utilise apiPost avec nouvelle structure ApiResponse
                const response = await apiPost('/api/services/create', servicePayload);

                console.log('[FormulaireYukpoIntelligentScreen] 📡 Réponse API:', response);

                if (!response.success || !response.data) {
                  const errorMessage = response.error || 'Erreur inconnue';
                  console.error('[FormulaireYukpoIntelligentScreen] ❌ Erreur API:', errorMessage);
                  console.error('[FormulaireYukpoIntelligentScreen] ❌ Data:', response.data);
                  console.error('[FormulaireYukpoIntelligentScreen] ❌ Response complet:', JSON.stringify(response, null, 2));
                  console.error('[FormulaireYukpoIntelligentScreen] ❌ Payload qui a causé l\'erreur:', JSON.stringify(servicePayload, null, 2));

                  // ✅ AMÉLIORATION : Construire un log d'erreur détaillé copiable
                  const errorLog = {
                    timestamp: new Date().toISOString(),
                    status: 'ERROR',
                    phase: 'Service Creation',
                    endpoint: '/api/services/create',
                    errorMessage: response.error || response.message || 'Erreur inconnue',
                    responseData: response.data,
                    responseError: response.error,
                    payloadSize: `${(JSON.stringify(servicePayload).length / 1024).toFixed(2)} KB`,
                    userInfo: {
                      userId: user?.id,
                      hasToken: !!user?.token
                    },
                    // Masquer les données sensibles mais montrer la structure
                    payloadStructure: {
                      user_id: servicePayload.user_id,
                      dataKeys: Object.keys(servicePayload.data || {}),
                      productsCount: servicePayload.data?.produits?.length || 0,
                      hasGpsFix: !!servicePayload.data?.gps_fixe
                    }
                  };

                  const errorLogString = JSON.stringify(errorLog, null, 2);
                  console.error('[FormulaireYukpoIntelligentScreen] 📋 LOG ERREUR COMPLET:', errorLogString);

                  // ✅ Copier automatiquement dans le presse-papiers
                  Clipboard.setStringAsync(errorLogString);

                  // ✅ AMÉLIORATION : Messages d'erreur plus spécifiques selon le type d'erreur
                  let alertTitle = '❌ Erreur de création';
                  let alertMessage = errorMessage;

                  if (errorMessage.includes('Network request failed') || errorMessage.includes('Impossible de se connecter')) {
                    alertTitle = '🌐 Problème de connexion';
                    alertMessage = `Problème de connexion réseau détecté.\n\n${errorMessage}\n\nVérifiez votre connexion internet et réessayez.`;
                  } else if (errorMessage.includes('timeout') || errorMessage.includes('expiré')) {
                    alertTitle = '⏱️ Timeout de requête';
                    alertMessage = `La requête a pris trop de temps.\n\n${errorMessage}\n\nVotre service contient peut-être trop de données. Essayez de réduire le nombre de médias.`;
                  } else if (errorMessage.includes('413') || errorMessage.includes('trop volumineux')) {
                    alertTitle = '📦 Données trop volumineuses';
                    alertMessage = `Votre service contient trop de données.\n\n${errorMessage}\n\nConseils :\n- Réduisez le nombre d'images par produit\n- Raccourcissez les vidéos\n- Supprimez les produits non essentiels`;
                  }

                  Alert.alert(
                    alertTitle,
                    `${alertMessage}\n\n📋 Le log d'erreur détaillé a été copié dans votre presse-papiers.\n\nVous pouvez le coller pour analyse.`,
                    [
                      {
                        text: 'Copier à nouveau',
                        onPress: () => {
                          Clipboard.setStringAsync(errorLogString);
                          Alert.alert('✅ Copié', 'Le log d\'erreur a été copié dans le presse-papiers');
                        }
                      },
                      { text: 'OK', style: 'cancel' }
                    ]
                  );
                  throw new Error(`Erreur création service: ${errorMessage}`);
                }

                const result: any = response.data;
                console.log('[FormulaireYukpoIntelligentScreen] ✅ Service créé avec succès:', result);

                // ✅ NOTE : Le nouveau JWT est automatiquement géré par apiCall
                // Il est sauvegardé dans AsyncStorage quand le header x-new-jwt est présent
                // Voir mobile/src/services/api.ts lignes 102-105
                // Le solde de tokens est aussi mis à jour automatiquement

                // ✅ SUPPRIMÉ: Vérification tickets de voyage - Géré maintenant via les champs dynamiques
                // Les tickets de voyage sont gérés via les champs autocomplete et date dans le formulaire

                setSuccessData({ serviceId: result?.id || result?.service_id || 'nouveau', cout: coutReel });
                setShowSuccessToast(true);
                DeviceEventEmitter.emit('service:refresh');

                // ✅ Marquer la soumission comme terminée
                setIsSubmitting(false);
                setLoading(false);

                // Redirection après 3 secondes
                setTimeout(() => {
                  if (fromMesServices) {
                    (navigation as any).navigate('Main', { screen: 'Services' });
                  } else {
                    (navigation as any).navigate('Home');
                  }
                }, 3000);

              } catch (innerError: any) {
                console.error('[FormulaireYukpoIntelligentScreen] ❌ Erreur création:', innerError);

                // ✅ AMÉLIORATION : Log d'erreur détaillé avec copie automatique
                const errorLog = {
                  timestamp: new Date().toISOString(),
                  status: 'ERROR',
                  phase: 'Service Creation',
                  errorMessage: innerError.message || 'Erreur inconnue',
                  errorStack: innerError.stack,
                  userInfo: {
                    userId: user?.id,
                    hasToken: !!user?.token
                  }
                };

                const errorLogString = JSON.stringify(errorLog, null, 2);
                console.error('[FormulaireYukpoIntelligentScreen] 📋 LOG ERREUR:', errorLogString);

                // Copier dans le presse-papiers
                Clipboard.setStringAsync(errorLogString);

                Alert.alert(
                  '❌ Erreur de création',
                  `${innerError.message || 'Impossible de créer le service'}\n\n📋 Le log d'erreur a été copié dans votre presse-papiers.`,
                  [
                    {
                      text: 'Copier à nouveau',
                      onPress: () => {
                        Clipboard.setStringAsync(errorLogString);
                        Alert.alert('✅ Copié', 'Le log d\'erreur a été copié');
                      }
                    },
                    { text: 'OK', style: 'cancel' }
                  ]
                );

                // ✅ Remettre les flags à false en cas d'erreur
                setIsSubmitting(false);
                setLoading(false);
              }
            }
          }
        ]
      );

    } catch (error: any) {
      console.error('[FormulaireYukpoIntelligentScreen] Erreur soumission:', error);

      // ✅ AMÉLIORATION : Log d'erreur détaillé avec copie automatique
      const errorLog = {
        timestamp: new Date().toISOString(),
        status: 'ERROR',
        phase: 'Form Submission',
        errorMessage: error?.message || 'Erreur inconnue',
        errorStack: error?.stack,
        userInfo: {
          userId: user?.id,
          hasToken: !!user?.token
        }
      };

      const errorLogString = JSON.stringify(errorLog, null, 2);
      console.error('[FormulaireYukpoIntelligentScreen] 📋 LOG ERREUR SOUMISSION:', errorLogString);

      // Copier dans le presse-papiers
      Clipboard.setStringAsync(errorLogString);

      Alert.alert(
        '❌ Erreur',
        `${error instanceof Error ? error.message : 'Impossible de créer le service'}\n\n📋 Le log d'erreur a été copié dans votre presse-papiers.`,
        [
          {
            text: 'Copier à nouveau',
            onPress: () => {
              Clipboard.setStringAsync(errorLogString);
              Alert.alert('✅ Copié', 'Le log d\'erreur a été copié');
            }
          },
          { text: 'OK', style: 'cancel' }
        ]
      );
      // ✅ Remettre les flags à false en cas d'erreur avant l'Alert
      setLoading(false);
      setIsSubmitting(false);
    }
    // ✅ IMPORTANT : Ne pas mettre de finally ici car l'Alert gère loading séparément
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={modernColors.primaryGradient}
        style={styles.header}
      >
        <NavigatorToolbar
          tone="dark"
          showHandle={false}
          density="compact"
          backIcon="back"
          title={isReadonly ? 'Consultation' : mode === 'edit' ? 'Modification' : 'Formulaire Intelligent'}
          subtitle={isReadonly ? 'Mode lecture seule' : mode === 'edit' ? 'Modification en cours' : 'Propulsé par l\'IA Yukpo'}
          onClose={handleGoBack}
        />
      </LinearGradient>

      <View style={styles.scrollView}>
        {/* Étape 1: Génération du formulaire */}
        {activeStep === 1 && (
          <ScrollView
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.stepContainer}>
              {/* Card d'introduction */}
              <NativeCard style={styles.introCard}>
                <View style={styles.iconCircle}>
                  <SafeIcon name="star" size={32} color={modernColors.primary} />
                </View>
                <Text style={styles.introTitle}>Formulaire Yukpo Intelligent</Text>
                <Text style={styles.introDescription}>
                  Notre IA va analyser vos données et générer un formulaire personnalisé adapté à votre besoin
                </Text>
              </NativeCard>

              {/* Card des données analysées */}
              <NativeCard style={styles.dataCard}>
                <View style={styles.cardHeader}>
                  <SafeIcon name="file" size={20} color={modernColors.primary} />
                  <Text style={styles.cardTitle}>Données à analyser</Text>
                </View>
                <NativeDivider style={styles.divider} />

                {/* Affichage des données du backend */}
                {suggestion.data && Object.keys(suggestion.data).length > 0 ? (
                  <View style={styles.dataContainer}>
                    {Object.entries(suggestion.data || {}).map(([key, value], index) => {
                      const fieldValue = typeof value === 'object' && value !== null ? (value as any).valeur || JSON.stringify(value) : value;
                      const fieldLabel = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                      return (
                        <View key={index} style={styles.dataItem}>
                          <View style={styles.dataIcon}>
                            <SafeIcon name="check-circle" size={18} color={modernColors.success} />
                          </View>
                          <View style={styles.dataContent}>
                            <Text style={styles.dataLabel}>{fieldLabel}</Text>
                            <Text style={styles.dataText} numberOfLines={2}>
                              {String(fieldValue).substring(0, 100)}
                              {String(fieldValue).length > 100 ? '...' : ''}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : suggestion.texte ? (
                  <View style={styles.dataItem}>
                    <View style={styles.dataIcon}>
                      <SafeIcon name="message" size={18} color={modernColors.info} />
                    </View>
                    <View style={styles.dataContent}>
                      <Text style={styles.dataLabel}>Texte</Text>
                      <Text style={styles.dataText} numberOfLines={2}>
                        {suggestion.texte.substring(0, 100)}...
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Affichage des médias */}
                {mediaFiles.images.length > 0 && (
                  <View style={styles.dataItem}>
                    <View style={styles.dataIcon}>
                      <SafeIcon name="image" size={18} color={modernColors.success} />
                    </View>
                    <View style={styles.dataContent}>
                      <Text style={styles.dataLabel}>Images</Text>
                      <Text style={styles.dataText}>{mediaFiles.images.length} image(s)</Text>
                    </View>
                  </View>
                )}

                {mediaFiles.audios.length > 0 && (
                  <View style={styles.dataItem}>
                    <View style={styles.dataIcon}>
                      <SafeIcon name="mic" size={18} color={modernColors.warning} />
                    </View>
                    <View style={styles.dataContent}>
                      <Text style={styles.dataLabel}>Audio</Text>
                      <Text style={styles.dataText}>{mediaFiles.audios.length} fichier(s) audio</Text>
                    </View>
                  </View>
                )}

                {gps && (
                  <View style={styles.dataItem}>
                    <View style={styles.dataIcon}>
                      <SafeIcon name="map-pin" size={18} color={modernColors.error} />
                    </View>
                    <View style={styles.dataContent}>
                      <Text style={styles.dataLabel}>Position GPS</Text>
                      <Text style={styles.dataText}>{gps}</Text>
                    </View>
                  </View>
                )}

                {/* Message si aucune donnée */}
                {!suggestion.data && !suggestion.texte && mediaFiles.images.length === 0 && mediaFiles.audios.length === 0 && !gps && (
                  <View style={styles.noDataContainer}>
                    <SafeIcon name="info" size={40} color={modernColors.textSecondary} />
                    <Text style={styles.noDataText}>Aucune donnée à analyser</Text>
                  </View>
                )}
              </NativeCard>

              {/* Bouton de génération */}
              <NativeButton
                title={loading ? "⏳ Génération..." : "✨ Générer le formulaire"}
                onPress={genererFormulaire}
                variant="primary"
                size="large"
                style={styles.generateButton}
                disabled={loading}
              />
            </View>
          </ScrollView>
        )}

        {/* Étape 2: Formulaire avec navigation par blocs */}
        {activeStep === 2 && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            {/* Navigation par blocs - Sticky */}
            {blocks.length > 0 && (
              <>
                <View style={styles.stickyNavigation}>
                  {/* Indicateur de progression */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${progressPercentage}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {totalVisibleBlocks > 0 ? currentDisplayIndex + 1 : 0} / {totalVisibleBlocks || 0}
                    </Text>
                  </View>

                  {/* Navigation entre blocs (tabs horizontales scrollables) */}
                  <ScrollView
                    ref={blockNavigationRef}
                    horizontal
                    scrollEnabled={true}
                    showsHorizontalScrollIndicator={true}
                    pagingEnabled={false}
                    decelerationRate="fast"
                    snapToInterval={TAB_WIDTH}
                    snapToAlignment="start"
                    contentContainerStyle={styles.blockNavigationContent}
                    style={styles.blockNavigationScrollView}
                    scrollEventThrottle={16}
                  >
                    <View style={styles.blockNavigation}>
                      {displayedBlocks.map(({ block, index: originalIndex }) => (
                        <TouchableOpacity
                          key={block.id}
                          style={[
                            styles.blockTab,
                            currentBlock === originalIndex && styles.blockTabActive
                          ]}
                          onPress={() => goToBlock(originalIndex)}
                        >
                          <Text style={styles.blockTabIcon}>{block.icon}</Text>
                          <Text style={[
                            styles.blockTabText,
                            currentBlock === originalIndex && styles.blockTabTextActive
                          ]}>
                            {block.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* ✅ NOUVEAU 2025-11-06: Contenu scrollable HORIZONTAL entre blocs */}
                <ScrollView
                  ref={blockContentRef}
                  horizontal
                  pagingEnabled
                  scrollEnabled={blockHorizontalScrollEnabled}
                  showsHorizontalScrollIndicator={false}
                  style={styles.contentScrollViewHorizontal}
                  contentContainerStyle={styles.contentContainerHorizontal}
                  onMomentumScrollEnd={(event) => {
                    // ✅ Détecter le bloc affiché après scroll horizontal manuel
                    const scrollX = event.nativeEvent.contentOffset.x;
                    const displayIndex = Math.round(scrollX / width);
                    const blockInfo = displayedBlocks[displayIndex];
                    if (blockInfo && blockInfo.index !== currentBlock) {
                      console.log('[FormulaireYukpoIntelligent] 📱 Scroll manuel vers bloc', blockInfo.index);
                      setCurrentBlock(blockInfo.index);
                    }
                  }}
                  scrollEventThrottle={16}
                >
                  {/* Affichage de TOUS les blocs côte à côte */}
                  {displayedBlocks.map(({ block, index: blockIndex }) => (
                    <View key={block.id} style={[styles.blockPanel, { width }]}>
                      <ScrollView
                        style={styles.blockPanelScroll}
                        contentContainerStyle={styles.blockPanelContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        nestedScrollEnabled={true}
                      >
                        <View style={styles.sectionContainer}>
                          <LinearGradient
                            colors={['#3B82F6', '#1D4ED8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.sectionHeader}
                          >
                            <Text style={styles.sectionHeaderText}>
                              {block.icon} {block.title}
                            </Text>
                          </LinearGradient>

                          <NativeCard style={styles.sectionContent}>
                            {block.id === 'products' ? (
                              <>
                                {renderProductsBlock()}
                                {(block.fields || [])
                                  .filter((field) => !PRODUCT_BLOCK_FIELD_NAMES.includes(field.name))
                                  .map((field) => renderField(field))}
                              </>
                            ) : (
                              (block.fields || [])
                                .filter(field => field.name !== 'devise')
                                .map((field) => renderField(field))
                            )}
                          </NativeCard>

                          {!isReadonly && block.id === 'payment' && (
                            <View style={styles.finalActionContainer}>
                              <Text style={styles.finalActionTitle}>Finaliser le service</Text>
                              <Text style={styles.finalActionSubtitle}>
                                Vérifiez vos informations puis validez la création du service.
                              </Text>

                              <TouchableOpacity
                                style={[styles.finalActionButton, (loading || isSubmitting) && styles.finalActionButtonDisabled]}
                                onPress={soumettreFormulaire}
                                disabled={loading || isSubmitting}
                              >
                                <LinearGradient
                                  colors={modernColors.primaryGradient}
                                  style={styles.finalActionButtonGradient}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 0 }}
                                >
                                  <Text style={styles.finalActionButtonText}>
                                    {(loading || isSubmitting)
                                      ? (isAddingProductToExistingService ? 'Création du produit...' :
                                        isEditingServiceInfo ? 'Mise à jour...' :
                                          mode === 'edit' ? 'Modification...' : 'Création...')
                                      : (isAddingProductToExistingService ? 'Créer le produit' :
                                        isEditingServiceInfo ? 'Modifier les données du service' :
                                          mode === 'edit' ? 'Modifier le service' : 'Créer le service')}
                                  </Text>
                                  <SafeIcon name="check" size={20} color="#FFFFFF" />
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </ScrollView>
                    </View>
                  ))}

                  {/* Boutons de navigation */}
                  <View style={styles.navigationButtons}>
                    <TouchableOpacity
                      style={[
                        styles.navButton,
                        styles.navButtonSecondary,
                        currentDisplayIndex === 0 && styles.navButtonDisabled
                      ]}
                      onPress={goToPreviousBlock}
                      disabled={currentDisplayIndex === 0}
                    >
                      <SafeIcon name="chevron-left" size={20} color="#6B7280" />
                      <Text style={styles.navButtonTextSecondary}>Précédent</Text>
                    </TouchableOpacity>

                    {currentDisplayIndex < totalVisibleBlocks - 1 ? (
                      <TouchableOpacity
                        style={[styles.navButton, styles.navButtonPrimary]}
                        onPress={goToNextBlock}
                      >
                        <Text style={styles.navButtonTextPrimary}>Suivant</Text>
                        <SafeIcon name="chevron-right" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.navButtonPlaceholder} />
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Toast de succès */}
      {showSuccessToast && (
        <View style={styles.successOverlay}>
          <View style={styles.successContainer}>
            <LinearGradient
              colors={modernColors.successGradient}
              style={styles.successGradient}
            >
              <SafeIcon name="check" size={60} color="#fff" />
            </LinearGradient>
            <Text style={styles.successTitle}>Service créé avec succès !</Text>
            <Text style={styles.successText}>
              Coût: {successData?.cout} tokens
            </Text>
            <Text style={styles.successSubtext}>
              Redirection en cours...
            </Text>
          </View>
        </View>
      )}

      {/* Modal GPS moderne */}
      <ModernGPSModal
        visible={showGPSModal}
        onClose={() => setShowGPSModal(false)}
        onSelect={(coordinatesString) => {
          // Parser les coordonnées depuis le format string
          // Format: "lat,lng" pour un point ou "lat1,lng1|lat2,lng2|..." pour une zone
          const firstPoint = coordinatesString.split('|')[0].split(',');
          if (firstPoint.length === 2) {
            const lat = parseFloat(firstPoint[0]);
            const lng = parseFloat(firstPoint[1]);
            setSelectedLocation({ lat, lng });
          }

          // Stocker le format complet (point ou zone)
          setValeursFormulaire(prev => ({
            ...prev,
            gps_fixe: coordinatesString
          }));
          setShowGPSModal(false);
        }}
        currentLocation={selectedLocation}
        title="Sélection de localisation GPS"
        allowZoneSelection={true}
      />


      {/* ✅ SUPPRIMÉ: Modal de duplication de produit - Les produits sont maintenant gérés via les champs dynamiques */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  header: {
    paddingBottom: 24,
    paddingHorizontal: 0,
  },
  scrollView: {
    flex: 1,
  },
  stickyNavigation: {
    backgroundColor: modernColors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  contentScrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 300, // ✅ Espace supplémentaire pour le clavier
  },
  // ✅ NOUVEAU 2025-11-06: Styles pour scroll horizontal entre blocs
  contentScrollViewHorizontal: {
    flex: 1,
  },
  contentContainerHorizontal: {
    flexDirection: 'row',
  },
  blockPanel: {
    // width est défini dynamiquement (= largeur écran)
  },
  blockPanelScroll: {
    flex: 1,
  },
  blockPanelContent: {
    padding: 20,
    paddingBottom: 300,
  },
  stepContainer: {
    gap: 20,
  },
  introCard: {
    alignItems: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: modernColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  introDescription: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dataCard: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.text,
    marginLeft: 8,
  },
  divider: {
    marginVertical: 12,
  },
  dataContainer: {
    gap: 12,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dataIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: modernColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dataContent: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 4,
  },
  dataText: {
    fontSize: 12,
    color: modernColors.textSecondary,
    lineHeight: 16,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noDataText: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  generateButton: {
    marginTop: 8,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: modernColors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: modernColors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: modernColors.textSecondary,
    textAlign: 'center',
  },
  blockNavigation: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  blockTab: {
    minWidth: 120,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: modernColors.background,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
  blockTabActive: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  blockTabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  blockTabText: {
    fontSize: 12,
    color: modernColors.textSecondary,
    textAlign: 'center',
  },
  blockTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    gap: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionContent: {
    padding: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  variantCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  variantCalloutHighlighted: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  variantCalloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.primary,
  },
  variantCalloutTitleHighlighted: {
    color: '#FFFFFF',
  },
  variantCalloutText: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  variantCalloutTextHighlighted: {
    color: '#E0E7FF',
  },
  productBlockContent: {
    gap: 24,
  },
  productIntroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  productIntroIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIntroTextWrapper: {
    flex: 1,
  },
  productIntroTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: modernColors.text,
  },
  productIntroSubtitle: {
    fontSize: 12,
    color: modernColors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  productFieldGroup: {
    marginBottom: 20,
  },
  productCurrencyInfo: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    backgroundColor: '#EEF2FF',
  },
  productCurrencyInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#312E81',
    marginBottom: 4,
  },
  productCurrencyInfoValue: {
    fontSize: 13,
    color: '#1E1B4B',
    fontWeight: '600',
  },
  productHint: {
    fontSize: 12,
    color: modernColors.textSecondary,
    marginTop: 8,
  },
  productFieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: modernColors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  helperText: {
    fontSize: 12,
    color: modernColors.textSecondary,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  required: {
    color: modernColors.error,
    fontSize: 16,
  },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: modernColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: modernColors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  fieldInputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  fieldErrorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  textareaInput: {
    minHeight: 220,
    paddingTop: 16,
  },
  productDescriptionInput: {
    minHeight: 300,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  productDescriptionText: {
    lineHeight: 24,
    fontSize: 15,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  navButtonPlaceholder: {
    flex: 1,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: modernColors.border,
  },
  navButtonPrimary: {
    backgroundColor: modernColors.primary,
  },
  navButtonSuccess: {
    backgroundColor: modernColors.success,
  },
  navButtonDisabled: {
    opacity: 0.5,
    elevation: 0,
  },
  navButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: modernColors.text,
  },
  navButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navButtonTextSuccess: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  finalActionContainer: {
    marginTop: 28,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  finalActionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
  },
  finalActionSubtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    lineHeight: 20,
  },
  finalActionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  finalActionButtonDisabled: {
    opacity: 0.7,
  },
  finalActionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  finalActionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  successContainer: {
    alignItems: 'center',
    padding: 32,
  },
  successGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: modernColors.textSecondary,
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
  },
  // Styles pour le bloc promotion
  promotionBlock: {
    gap: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: modernColors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  checkboxChecked: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
    flex: 1,
  },
  promotionFields: {
    gap: 12,
    marginTop: 8,
  },
  // Styles pour le select moderne
  modernSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: modernColors.surface,
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 12,
    minHeight: 48,
  },
  selectText: {
    fontSize: 16,
    color: modernColors.text,
    flex: 1,
  },
  selectPlaceholder: {
    color: modernColors.textSecondary,
  },
  pickerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.textSecondary,
  },
  pickerButtonTextActive: {
    color: '#FFFFFF',
  },
  readonlyCurrencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    marginTop: 8,
  },
  readonlyCurrencyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#312E81',
  },
  hintBox: {
    backgroundColor: modernColors.background,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  hintText: {
    fontSize: 12,
    color: modernColors.textSecondary,
    lineHeight: 16,
  },
  hintBold: {
    fontWeight: '600',
    color: modernColors.text,
  },
  // ✅ PHASE 3: Styles pour statistiques autocomplete
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  statsText: {
    fontSize: 13,
    fontWeight: '600',
    color: modernColors.success,
  },
  statsDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: modernColors.textSecondary,
  },
  statsSubtext: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  // ✅ PHASE 3: Styles pour exemple dynamique
  exampleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  exampleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.primary,
  },
  exampleValue: {
    flex: 1,
    fontSize: 12,
    color: modernColors.text,
    fontStyle: 'italic',
  },
  // Style pour le ScrollView horizontal du blockNavigation
  blockNavigationScrollView: {
    marginBottom: 20,
    maxHeight: 80,
  },
  blockNavigationContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  // Styles pour le champ GPS personnalisé
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: modernColors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: modernColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
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
  // Styles pour les champs readonly
  readonlyCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: modernColors.background,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
  readonlyLabelContainer: {
    flex: 1,
  },
  readonlyHint: {
    fontSize: 11,
    color: modernColors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Styles pour le bouton de diagnostic
  autoGrowingInput: {
    minHeight: 52,
  },
  autoGrowingInputName: {
    minHeight: 52,
  },
  autoGrowingInputCategory: {
    minHeight: 52,
  },
});

export default FormulaireYukpoIntelligentScreen;
