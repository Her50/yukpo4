import { useNavigation, useRoute } from '@react-navigation/native';
// Code corrigé (remplace @ts-ignore)
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
import StableTextInput from '../components/StableTextInput';
import NavigatorToolbar from '../components/NavigatorToolbar';
// ✅ SUPPRIMÉ: ProductManagerMobile intégré directement dans le formulaire
import LinearAutocompleteEditor from '../components/LinearAutocompleteEditor';
import LocationSelector, { LocationObject } from '../components/LocationSelector';
import PriceVariantSelector from '../components/PriceVariantSelector';
// ✅ AJOUT: Composants pour modalités personnalisées et sélection multiple
import ProductFieldSelector from '../components/ProductFieldSelector';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
// TODO: Fix TypeScript type issue
// Code corrigé (remplace @ts-ignore)
import { modernColors } from '../theme/modernTheme';
import { DynamicField, IASuggestion, processIASuggestion } from '../utils/formDispatcher';
import { MAX_PRODUCT_IMAGES, mergeImageSources, orderImagesWithPrimary } from '../utils/mediaHelpers';
import ProductDeliveryConfigModal from '../components/delivery/ProductDeliveryConfigModal';
import DeliveryAutoConfigPromptModal from '../components/delivery/DeliveryAutoConfigPromptModal';
// ✅ NOUVEAU: Import des fonctions de synchronisation prix_variation <-> sous-caractéristiques
import { applyPriceVariantToProduits, extractPriceVariant } from '../utils/priceVariant';

const { width } = Dimensions.get('window');

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

const FormulaireYukpoIntelligentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, logout } = useAuth();
  const mainScrollViewRef = React.useRef<KeyboardAwareScrollView>(null);
  const blockRefs = React.useRef<Record<number, View | null>>({});
  const blockPositions = React.useRef<Record<number, number>>({});

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

  // ✅ FONCTION HELPER: Extraire devise depuis variante de prix (comme dans AjouterProduitSimpleScreen)
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
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  // ✅ NOUVEAU: État pour identifier quel champ location est en cours de modification
  const [gpsModalForField, setGpsModalForField] = useState<string | null>(null);
  // ✅ NOUVEAU: États pour le modal de configuration de livraison
  const [showProductDeliveryConfig, setShowProductDeliveryConfig] = useState(false);
  const [productDeliveryConfigData, setProductDeliveryConfigData] = useState<{
    serviceId: number;
    productIndex: number;
    productName: string;
  } | null>(null);
  // ✅ NOUVEAU: État pour le modal de confirmation de livraison automatique
  const [showDeliveryAutoPrompt, setShowDeliveryAutoPrompt] = useState(false);
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
  // ✅ NOUVEAU: États pour la modal de confirmation de création de produit
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    serviceId: number;
    productIndex: number;
    productName: string;
    isPrestation: boolean;
    cout?: number;
  } | null>(null);
  // ✅ SUPPRIMÉ: products et setProducts - Les produits sont maintenant gérés via les champs dynamiques (autocomplete, price_variant)
  const [paymentMethod, setPaymentMethod] = useState<any>(null); // ✅ NOUVEAU: Mode de paiement

  // États pour la navigation par blocs
  // ✅ REFONTE COMPLÈTE: Utiliser currentDisplayIndex comme source de vérité unique pour la navigation
  // currentDisplayIndex est l'index dans displayedBlocks (blocs visibles)
  // currentBlock est calculé à partir de currentDisplayIndex pour garantir la synchronisation
  const [currentDisplayIndex, setCurrentDisplayIndex] = useState(0);
  const [blocks, setBlocks] = useState<{
    id: string;
    title: string;
    icon: string;
    fields: DynamicField[];
  }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // ✅ SUPPRIMÉ: dynamicTextareaHeights - plus nécessaire après refonte de description_produit

  const displayedBlocks = useMemo(() => {
    if (!blocks || blocks.length === 0) {
      return [];
    }

    return blocks.reduce((acc: any[], block, index) => {
      if (isEditingServiceInfo && block.id === 'products') {
        return acc;
      }

      // ✅ Masquer le dernier bloc "Autres informations" (type service/produit) - 6 étapes au lieu de 7
      if (block.id === 'other') {
        return acc;
      }

      acc.push({ block, index });
      return acc;
    }, []);
  }, [blocks, isEditingServiceInfo]);

  // ✅ REFONTE: Calculer currentBlock à partir de currentDisplayIndex pour garantir la synchronisation
  const currentBlock = useMemo(() => {
    if (!displayedBlocks || displayedBlocks.length === 0) {
      return 0;
    }

    // ✅ Garantir que currentDisplayIndex est valide
    const validDisplayIndex = Math.max(0, Math.min(currentDisplayIndex, displayedBlocks.length - 1));
    
    // ✅ Si currentDisplayIndex a changé, le corriger
    if (validDisplayIndex !== currentDisplayIndex) {
      console.warn('[NAVIGATION_SYNC] ⚠️ Correction currentDisplayIndex:', currentDisplayIndex, '→', validDisplayIndex);
      setTimeout(() => setCurrentDisplayIndex(validDisplayIndex), 0);
    }

    const displayedBlock = displayedBlocks[validDisplayIndex];
    return displayedBlock ? displayedBlock.index : 0;
  }, [displayedBlocks, currentDisplayIndex]);

  const totalVisibleBlocks = displayedBlocks.length;
  const progressPercentage = totalVisibleBlocks > 0
    ? ((currentDisplayIndex + 1) / totalVisibleBlocks) * 100
    : 0;

  // ✅ CORRIGÉ: Calculer le bloc actif UNE SEULE FOIS pour garantir la synchronisation entre l'en-tête et les champs
  const activeBlockData = useMemo(() => {
    if (!displayedBlocks || displayedBlocks.length === 0) {
      return null;
    }
    const validDisplayIndex = Math.max(0, Math.min(currentDisplayIndex, displayedBlocks.length - 1));
    const activeDisplayedBlock = displayedBlocks[validDisplayIndex];
    if (!activeDisplayedBlock) {
      return null;
    }
    return {
      validDisplayIndex,
      activeDisplayedBlock,
      block: activeDisplayedBlock.block,
      blockIndex: activeDisplayedBlock.index,
    };
  }, [displayedBlocks, currentDisplayIndex]);

  // ✅ CORRIGÉ: Calculer les champs à partir du bloc actif synchronisé
  const currentBlockFields = useMemo(() => {
    if (!activeBlockData || !activeBlockData.block) {
      return [];
    }
    const fieldsToRender = (Array.isArray(activeBlockData.block.fields) ? activeBlockData.block.fields : [])
      .filter(field => field && field.name !== 'devise'); // ✅ Masquer le champ devise (intégré dans prix)
    return fieldsToRender;
  }, [activeBlockData]);

  // ✅ REFONTE: Fonction helper pour convertir blockIndex (dans blocks) en displayIndex (dans displayedBlocks)
  const getDisplayIndexFromBlockIndex = useCallback((blockIndex: number): number => {
    if (!displayedBlocks || displayedBlocks.length === 0) {
      return 0;
    }
    const displayIndex = displayedBlocks.findIndex(item => item && item.index === blockIndex);
    return displayIndex === -1 ? 0 : displayIndex;
  }, [displayedBlocks]);

  // ✅ REFONTE: Fonction helper pour naviguer vers un bloc par son index dans blocks
  const navigateToBlockIndex = useCallback((blockIndex: number) => {
    const displayIndex = getDisplayIndexFromBlockIndex(blockIndex);
    setCurrentDisplayIndex(displayIndex);
  }, [getDisplayIndexFromBlockIndex]);

  // ✅ REFONTE: Synchronisation automatique de currentDisplayIndex avec displayedBlocks
  useEffect(() => {
    if (!displayedBlocks || displayedBlocks.length === 0) {
      return;
    }

    // ✅ Garantir que currentDisplayIndex est toujours valide
    const validDisplayIndex = Math.max(0, Math.min(currentDisplayIndex, displayedBlocks.length - 1));
    
    if (validDisplayIndex !== currentDisplayIndex) {
      console.log('[NAVIGATION_SYNC] 🔄 Correction currentDisplayIndex:', {
        ancien: currentDisplayIndex,
        nouveau: validDisplayIndex,
        totalBlocs: displayedBlocks.length,
      });
      setCurrentDisplayIndex(validDisplayIndex);
    }

    // ✅ Log de synchronisation pour debug
    const displayedBlock = displayedBlocks[validDisplayIndex];
    if (displayedBlock) {
      console.log('[NAVIGATION_SYNC] ✅ Synchronisation OK:', {
        currentDisplayIndex: validDisplayIndex,
        currentBlock: displayedBlock.index,
        blockId: displayedBlock.block.id,
        blockTitle: displayedBlock.block.title,
      });
    }
  }, [displayedBlocks, currentDisplayIndex]);

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
          (navigation as any).navigate('MesServices');
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
      let fieldAssigned = false; // ✅ NOUVEAU 2025-12-23: Tracker pour éviter les duplications

      // ✅ CORRIGÉ 2025-12-23: Retirer 'prix' et 'devise' du bloc Informations générales
      // car ils peuvent être des champs produits. Seuls les champs spécifiques au SERVICE vont ici.
      // Bloc Informations générales (UNIQUEMENT champs SERVICE, pas produits)
      if (['titre_service', 'category', 'description', 'is_tarissable', 'vitesse_tarissement'].includes(fieldName)) {
        blocks[0].fields.push(field);
        fieldAssigned = true;
        console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ "${field.name}" → Bloc 0 (Informations générales)`);
      }
      // Bloc Contact
      else if (['whatsapp', 'telephone', 'email', 'website', 'adresse', 'horaires'].includes(fieldName)) {
        blocks[1].fields.push(field);
        fieldAssigned = true;
        console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ "${field.name}" → Bloc 1 (Contact)`);
      }
      // Bloc Localisation (✅ NOUVEAU 2025-11-06: lieu_produit déplacé vers bloc Produits)
      else if (['gps_fixe', 'zone_intervention', 'localisation', 'pays', 'ville', 'quartier'].includes(fieldName)) {
        blocks[2].fields.push(field);
        fieldAssigned = true;
        console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ "${field.name}" → Bloc 2 (Localisation)`);
      }
      // Bloc Produits
      // ✅ NOUVEAU 2025-11-06: Inclure lieu_produit, images, videos dans le bloc produits
      // ✅ CORRECTION: Ne plus dépendre de la présence d'un champ produits de l'IA
      // Le bloc produits sera toujours présent avec un champ par défaut (voir plus bas)
      // ✅ AJOUT: price_variant (variabilite_prix) va aussi dans le bloc produits
      // ✅ IMPORTANT: Les champs spécifiques au produit (nom_produit, categorie_produit, description_produit, prix_produit, devise_produit)
      //    vont dans le bloc Produits, PAS dans Informations générales (qui contient titre_service, category, description)
      // ✅ CORRECTION CRITIQUE: Détecter aussi les champs par leur typeDonnee (autocomplete, price_variant)
      // ✅ CORRIGÉ 2025-12-23: 'prix' et 'devise' vont dans Produits (pas Informations générales) car ils sont généralement liés aux produits
      else if (
        ['liste_produits', 'produits', 'listeproduit', 'variabilite_prix', 'price_variant',
          'nom_produit', 'categorie_produit', 'description_produit', 'prix_produit', 'devise_produit',
          'lieu_produit', 'lieu_commercial', 'lieu_commercialisation', // ✅ NOUVEAU: Lieu dans produits
          'prix', 'devise', // ✅ CORRIGÉ: Prix et devise dans produits (retirés de Informations générales)
          'images', 'videos' // ✅ NOUVEAU: Médias dans produits
        ].includes(fieldName) ||
        field.typeDonnee === 'price_variant' ||
        field.typeDonnee === 'autocomplete'
      ) {
        blocks[3].fields.push(field);
        fieldAssigned = true;
        console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ "${field.name}" → Bloc 3 (Produits/ Prestations) (typeDonnee: ${field.typeDonnee})`);
      }
      // Bloc Médias (✅ NOUVEAU 2025-11-06: images/videos déplacées vers bloc Produits, ne garder que audios/documents)
      else if (['audios', 'documents'].includes(fieldName)) {
        blocks[4].fields.push(field);
        fieldAssigned = true;
        console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ "${field.name}" → Bloc 4 (Médias)`);
      }
      // Bloc Paiement
      else if (['mode_paiement', 'paiement', 'payment'].includes(fieldName)) {
        blocks[5].fields.push(field);
        fieldAssigned = true;
        console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ "${field.name}" → Bloc 5 (Paiement)`);
      }
      // Autres
      else {
        blocks[6].fields.push(field);
        fieldAssigned = true;
        console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ "${field.name}" → Bloc 6 (Autres)`);
      }

      // ✅ CRITIQUE 2025-12-23: Vérifier qu'un champ n'est pas ajouté deux fois
      if (!fieldAssigned) {
        console.error(`[FormulaireYukpoIntelligentScreen] ❌ ERREUR: Champ "${field.name}" n'a pas été assigné à un bloc !`);
      }
    });

    // ✅ NOUVEAU 2025-11-06: Fonction de tri pour l'ordre des champs du bloc Produits
    const sortProductFields = (fields: DynamicField[]): DynamicField[] => {
      const fieldOrder = [
        'nom_produit', // 1. Nom du produit
        'categorie_produit', // 2. Catégorie
        'description_produit', // 3. Description
        'quantite_disponible', // 4. Quantité disponible
        'produits', // 5. Caractéristiques (autocomplete)
        'lieu_produit', 'lieu_commercial', 'lieu_commercialisation', // 6. Lieu
        'prix', 'prix_produit', // 7. Prix
        'devise', 'devise_produit', // 8. Devise (sera affichée inline avec prix)
        'price_variant', 'variabilite_prix', // 9. Variations prix
        'images', 'videos', '_product_media_manager' // 10. Médias
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
          placeholder: 'Décrivez les caractéristiques spécifiques du produit...',
          multiline: true,
          minLines: 3
        },
        {
          name: 'quantite_disponible',
          type: 'number',
          typeDonnee: 'number',
          label: 'Quantité disponible',
          required: false,
          placeholder: 'Ex: 50'
        },
        {
          name: 'variabilite_prix',
          type: 'price_variant',
          typeDonnee: 'price_variant',
          label: isPrestation ? 'Variantes prestation' : 'Variantes produit',
          variable: isPrestation ? 'formule' : 'option',
          required: false,
          modalites: [] // ✅ Sera rempli par l'IA si détecté, sinon vide pour permettre l'ajout manuel
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
          placeholder: 'Décrivez les caractéristiques spécifiques du produit...',
          multiline: true,
          minLines: 3
        },
        {
          name: 'quantite_disponible',
          type: 'number',
          typeDonnee: 'number',
          label: 'Quantité disponible',
          required: false,
          placeholder: 'Ex: 50'
        },
        {
          name: 'variabilite_prix',
          type: 'price_variant',
          typeDonnee: 'price_variant',
          label: isPrestation ? 'Variantes prestation' : 'Variantes produit',
          variable: isPrestation ? 'formule' : 'option',
          required: false,
          modalites: [] // ✅ Sera rempli par l'IA si détecté, sinon vide pour permettre l'ajout manuel
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
          placeholder: 'Décrivez les caractéristiques spécifiques du produit/prestation...',
          multiline: true,
          minLines: 3 // ✅ REFONTE: Même nombre de lignes que description (3 au lieu de 6)
        } as DynamicField);
      }

      // ✅ NOUVEAU: Ajouter le champ quantité disponible (comme dans AjouterProduitSimpleScreen)
      const hasQuantiteDisponible = productsBlock.fields.some(f => f.name === 'quantite_disponible' || f.name === 'quantity' || f.name === 'stock');
      if (!hasQuantiteDisponible) {
        // Insérer après description_produit
        const insertIndex = (hasNomProduit ? 1 : 0) + (hasCategorieProduit ? 1 : 0) + (hasDescriptionProduit ? 1 : 0);
        productsBlock.fields.splice(insertIndex, 0, {
          name: 'quantite_disponible',
          type: 'number',
          typeDonnee: 'number',
          label: 'Quantité disponible',
          required: false,
          placeholder: 'Ex: 50',
          value: formValues.quantite_disponible || ''
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
      // ✅ CORRIGÉ 2025-12-24: Ne pas afficher le champ devise (gestion automatique comme dans AjouterProduitSimpleScreen)
      // La devise est déterminée automatiquement depuis la variante de prix ou les données IA
      // Elle sera définie dans initialValues mais ne sera pas affichée comme un champ select
      if (!hasDeviseProduit && !hasVariationPrix) {
        // ✅ Déterminer la devise automatiquement
        const priceVariantData = formValues.variabilite_prix || formValues.variation_prix || formValues.price_variant;
        const variantCurrency = getCurrencyFromVariant(priceVariantData);
        const deviseFromForm = formValues.devise_produit || formValues.devise;
        const autoCurrency = (
          (typeof deviseFromForm === 'string' && deviseFromForm.trim().length > 0
            ? deviseFromForm.trim().toUpperCase()
            : undefined) ||
          variantCurrency ||
          'XAF'
        );
        
        // ✅ Mettre à jour formValues avec la devise automatique (sans afficher le champ)
        if (!formValues.devise_produit) {
          formValues.devise_produit = autoCurrency;
        }
        
        console.log('[FormulaireYukpoIntelligentScreen] ✅ Devise déterminée automatiquement:', autoCurrency);
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

    // ✅ CRITIQUE 2025-12-23: Log final pour vérifier la distribution des champs
    console.log('[FormulaireYukpoIntelligentScreen] 📊 RÉSUMÉ DISTRIBUTION DES BLOCS:');
    blocksWithFixedOnes.forEach((block, index) => {
      console.log(`  Bloc ${index} (${block.id}): ${block.fields.length} champs - ${block.fields.map(f => f.name).join(', ')}`);
    });

    return blocksWithFixedOnes.filter(block => block.fields.length > 0);
  };

  // Fonction de validation des champs
  const validateField = (field: DynamicField, value: any): { isValid: boolean; error: string } => {
    // ✅ CORRECTION CRITIQUE: Extraire la valeur string correctement pour éviter les crashes
    const getStringValue = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'object' && val !== null) {
        if ('valeur' in val && typeof val.valeur === 'string') return val.valeur;
        if ('raw' in val && typeof val.raw === 'string') return val.raw;
        // Dernier recours: convertir en string
        try {
          return String(val);
        } catch {
          return '';
        }
      }
      try {
        return String(val);
      } catch {
        return '';
      }
    };

    const stringValue = getStringValue(value);
    const trimmedValue = stringValue.trim();

    // Champ obligatoire vide
    if (field.required && trimmedValue === '') {
      return { isValid: false, error: `${field.label} est obligatoire` };
    }

    // Si le champ n'est pas requis et est vide, pas besoin de validation supplémentaire
    if (trimmedValue === '') {
      return { isValid: true, error: '' };
    }

    // Validation spécifique pour WhatsApp
    if (field.name === 'whatsapp' && trimmedValue) {
      const whatsappRegex = /^(\+?237|00237)?[0-9]{9}$/;
      const cleanValue = trimmedValue.replace(/\s/g, '');
      if (!whatsappRegex.test(cleanValue)) {
        return { isValid: false, error: 'Numéro WhatsApp invalide (ex: +237 6XX XX XX XX)' };
      }
    }

    // Validation spécifique pour téléphone
    if (field.name === 'telephone' && trimmedValue) {
      const phoneRegex = /^(\+?237|00237)?[0-9]{9}$/;
      const cleanValue = trimmedValue.replace(/\s/g, '');
      if (!phoneRegex.test(cleanValue)) {
        return { isValid: false, error: 'Numéro de téléphone invalide' };
      }
    }

    // Validation spécifique pour email
    if ((field.type === 'email' || field.name === 'email') && trimmedValue) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedValue)) {
        return { isValid: false, error: 'Adresse email invalide' };
      }
    }

    // Validation spécifique pour URL
    if ((field.type === 'url' || field.name === 'website') && trimmedValue) {
      const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
      if (!urlRegex.test(trimmedValue)) {
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
    // ✅ CORRECTION CRITIQUE: Vérifier que blocks existe et que currentBlock est valide
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Aucun bloc disponible');
      return { isValid: true, errors: [], fieldErrors: {} };
    }

    if (currentBlock < 0 || currentBlock >= blocks.length) {
      console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Index de bloc invalide:', currentBlock, 'sur', blocks.length);
      return { isValid: true, errors: [], fieldErrors: {} };
    }

    const currentBlockData = blocks[currentBlock];
    if (!currentBlockData) {
      console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Bloc actuel non trouvé, index:', currentBlock);
      return { isValid: true, errors: [], fieldErrors: {} };
    }

    // ✅ CORRECTION CRITIQUE: Vérifier que fields existe et est un tableau
    if (!currentBlockData.fields || !Array.isArray(currentBlockData.fields)) {
      console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Bloc sans champs valides:', currentBlockData.id);
      return { isValid: true, errors: [], fieldErrors: {} };
    }

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
      try {
        // ✅ CORRECTION CRITIQUE: Extraire la valeur correctement pour éviter les crashes
        let value = valeursFormulaire[field.name];
        if (value && typeof value === 'object' && value !== null) {
          // Si c'est un objet complexe, extraire la valeur string
          if ('valeur' in value && typeof value.valeur === 'string') {
            value = value.valeur;
          } else if ('raw' in value && typeof value.raw === 'string') {
            value = value.raw;
          }
          // Sinon, garder la valeur telle quelle pour les autres types (autocomplete, etc.)
        }

        const validation = validateField(field, value);
        if (!validation.isValid) {
          errors.push(validation.error);
          newFieldErrors[field.name] = validation.error;
        }
      } catch (error) {
        console.error(`[FormulaireYukpoIntelligentScreen] ⚠️ Erreur validation champ ${field.name}:`, error);
        // Ne pas bloquer la validation en cas d'erreur inattendue
      }
    });

    return { isValid: errors.length === 0, errors, fieldErrors: newFieldErrors };
  };

  // ✅ REFONTE COMPLÈTE: Fonctions de navigation utilisant currentDisplayIndex comme source de vérité
  const goToNextBlock = () => {
    try {
      // ✅ Vérifier que displayedBlocks existe et n'est pas vide
      if (!displayedBlocks || !Array.isArray(displayedBlocks) || displayedBlocks.length === 0) {
        console.error('[NAVIGATION_BLOC] ❌ displayedBlocks invalide dans goToNextBlock');
        Alert.alert('Erreur', 'Impossible de naviguer. Veuillez réessayer.');
        return;
      }

      // ✅ Valider le bloc actuel avant de passer au suivant
      const validation = validateCurrentBlock();
      if (!validation.isValid) {
        setFieldErrors(validation.fieldErrors);
        const errorMessages = validation.errors
          .filter(err => err != null)
          .map(err => String(err))
          .filter(err => err.trim().length > 0);
        if (errorMessages.length > 0) {
          Alert.alert('Champs invalides', errorMessages.join('\n\n'), [{ text: 'OK' }]);
        }
        return;
      }

      // ✅ Effacer les erreurs si la validation réussit
      setFieldErrors({});

      // ✅ REFONTE: Utiliser currentDisplayIndex directement (source de vérité)
      const nextDisplayIndex = currentDisplayIndex + 1;
      
      if (nextDisplayIndex < displayedBlocks.length) {
        console.log('[NAVIGATION_BLOC] ✅ Navigation vers bloc suivant:', {
          from: currentDisplayIndex,
          to: nextDisplayIndex,
          blockId: displayedBlocks[nextDisplayIndex]?.block?.id,
          blockTitle: displayedBlocks[nextDisplayIndex]?.block?.title,
        });
        
        setCurrentDisplayIndex(nextDisplayIndex);
        
        // ✅ REFONTE: Scroller vers le début du ScrollView pour afficher le nouveau bloc
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              if (mainScrollViewRef.current) {
                const scrollView = mainScrollViewRef.current;
                if (typeof scrollView.scrollTo === 'function') {
                  scrollView.scrollTo({ x: 0, y: 0, animated: true });
                } else if (typeof scrollView.scrollToPosition === 'function') {
                  scrollView.scrollToPosition(0, 0, true);
                } else if (typeof scrollView.getScrollResponder === 'function') {
                  const scrollResponder = scrollView.getScrollResponder();
                  if (scrollResponder && typeof scrollResponder.scrollTo === 'function') {
                    scrollResponder.scrollTo({ x: 0, y: 0, animated: true });
                  }
                }
              }
            } catch (scrollError) {
              console.error('[NAVIGATION_BLOC] ⚠️ Erreur scroll:', scrollError);
            }
          });
        });
      } else {
        console.log('[NAVIGATION_BLOC] ℹ️ Dernier bloc atteint');
      }
    } catch (error) {
      console.error('[NAVIGATION_BLOC] ❌ Erreur:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la navigation. Veuillez réessayer.', [{ text: 'OK' }]);
    }
  };

  // ✅ REFONTE: goToPreviousBlock utilise currentDisplayIndex
  const goToPreviousBlock = () => {
    try {
      if (!displayedBlocks || !Array.isArray(displayedBlocks) || displayedBlocks.length === 0) {
        console.error('[NAVIGATION_BLOC] ❌ displayedBlocks invalide dans goToPreviousBlock');
        Alert.alert('Erreur', 'Impossible de naviguer. Veuillez réessayer.');
        return;
      }

      // ✅ REFONTE: Utiliser currentDisplayIndex directement
      const previousDisplayIndex = currentDisplayIndex - 1;
      
      if (previousDisplayIndex >= 0) {
        console.log('[NAVIGATION_BLOC] ✅ Navigation vers bloc précédent:', {
          from: currentDisplayIndex,
          to: previousDisplayIndex,
          blockId: displayedBlocks[previousDisplayIndex]?.block?.id,
          blockTitle: displayedBlocks[previousDisplayIndex]?.block?.title,
        });
        
        setCurrentDisplayIndex(previousDisplayIndex);
        
        // ✅ Scroller vers le début du ScrollView
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              if (mainScrollViewRef.current) {
                const scrollView = mainScrollViewRef.current;
                if (typeof scrollView.scrollTo === 'function') {
                  scrollView.scrollTo({ x: 0, y: 0, animated: true });
                } else if (typeof scrollView.scrollToPosition === 'function') {
                  scrollView.scrollToPosition(0, 0, true);
                } else if (typeof scrollView.getScrollResponder === 'function') {
                  const scrollResponder = scrollView.getScrollResponder();
                  if (scrollResponder && typeof scrollResponder.scrollTo === 'function') {
                    scrollResponder.scrollTo({ x: 0, y: 0, animated: true });
                  }
                }
              }
            } catch (scrollError) {
              console.error('[NAVIGATION_BLOC] ⚠️ Erreur scroll:', scrollError);
            }
          });
        });
      } else {
        console.log('[NAVIGATION_BLOC] ℹ️ Premier bloc atteint');
      }
    } catch (error) {
      console.error('[NAVIGATION_BLOC] ❌ Erreur:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la navigation. Veuillez réessayer.', [{ text: 'OK' }]);
    }
  };

  // ✅ REFONTE: goToBlock utilise currentDisplayIndex (blockIndex est l'index original dans blocks)
  const goToBlock = (blockIndex: number) => {
    try {
      if (!displayedBlocks || !Array.isArray(displayedBlocks) || displayedBlocks.length === 0) {
        console.error('[NAVIGATION_BLOC] ❌ displayedBlocks invalide dans goToBlock');
        return;
      }

      // ✅ REFONTE: Trouver le displayIndex correspondant au blockIndex
      const displayIndex = displayedBlocks.findIndex(item => item && item.index === blockIndex);
      
      if (displayIndex === -1) {
        console.warn('[NAVIGATION_BLOC] ⚠️ Bloc non trouvé dans displayedBlocks:', blockIndex);
        return;
      }

      // ✅ Vérifier la contrainte produits si nécessaire
      const productsBlockIndex = blocks.findIndex(b => b && b.id === 'products');
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

      console.log('[NAVIGATION_BLOC] ✅ Navigation vers bloc:', {
        blockIndex,
        displayIndex,
        blockId: displayedBlocks[displayIndex]?.block?.id,
        blockTitle: displayedBlocks[displayIndex]?.block?.title,
      });
      
      setCurrentDisplayIndex(displayIndex);
      
      // ✅ Scroller vers le début du ScrollView
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            if (mainScrollViewRef.current) {
              const scrollView = mainScrollViewRef.current;
              if (typeof scrollView.scrollTo === 'function') {
                scrollView.scrollTo({ x: 0, y: 0, animated: true });
              } else if (typeof scrollView.scrollToPosition === 'function') {
                scrollView.scrollToPosition(0, 0, true);
              } else if (typeof scrollView.getScrollResponder === 'function') {
                const scrollResponder = scrollView.getScrollResponder();
                if (scrollResponder && typeof scrollResponder.scrollTo === 'function') {
                  scrollResponder.scrollTo({ x: 0, y: 0, animated: true });
                }
              }
            }
          } catch (scrollError) {
            console.error('[NAVIGATION_BLOC] ⚠️ Erreur scroll:', scrollError);
          }
        });
      });
    } catch (error) {
      console.error('[NAVIGATION_BLOC] ❌ Erreur:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la navigation. Veuillez réessayer.', [{ text: 'OK' }]);
    }
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

            // ✅ NOUVEAU 2026-01-04: Extraire les produits depuis serviceData.data.produits.valeur
            // Les produits sont maintenant chargés depuis service_products et ajoutés dans data.produits.valeur
            if (serviceData?.data?.produits) {
              const produitsData = serviceData.data.produits;
              // Extraire le tableau de produits (peut être dans .valeur ou directement)
              const produitsArray = Array.isArray(produitsData?.valeur) 
                ? produitsData.valeur 
                : Array.isArray(produitsData) 
                  ? produitsData 
                  : [];
              
              // Si on a au moins un produit, extraire ses champs pour pré-remplir le formulaire
              if (produitsArray.length > 0) {
                const firstProduct = produitsArray[0];
                if (firstProduct && typeof firstProduct === 'object') {
                  // Extraire les champs du premier produit
                  if (firstProduct.nom_produit !== undefined) {
                    formValues.nom_produit = typeof firstProduct.nom_produit === 'object' && 'valeur' in firstProduct.nom_produit
                      ? firstProduct.nom_produit.valeur
                      : firstProduct.nom_produit;
                  }
                  if (firstProduct.categorie_produit !== undefined) {
                    formValues.categorie_produit = typeof firstProduct.categorie_produit === 'object' && 'valeur' in firstProduct.categorie_produit
                      ? firstProduct.categorie_produit.valeur
                      : firstProduct.categorie_produit;
                  }
                  if (firstProduct.description_produit !== undefined) {
                    formValues.description_produit = typeof firstProduct.description_produit === 'object' && 'valeur' in firstProduct.description_produit
                      ? firstProduct.description_produit.valeur
                      : firstProduct.description_produit;
                  }
                  if (firstProduct.prix_produit !== undefined) {
                    formValues.prix_produit = typeof firstProduct.prix_produit === 'object' && 'valeur' in firstProduct.prix_produit
                      ? firstProduct.prix_produit.valeur
                      : firstProduct.prix_produit;
                  }
                  if (firstProduct.devise_produit !== undefined) {
                    formValues.devise_produit = typeof firstProduct.devise_produit === 'object' && 'valeur' in firstProduct.devise_produit
                      ? firstProduct.devise_produit.valeur
                      : firstProduct.devise_produit;
                  }
                  // ✅ NOUVEAU 2026-01-04: Extraire variabilite_prix depuis le premier produit
                  if (firstProduct.variabilite_prix !== undefined || firstProduct.price_variant !== undefined) {
                    const variantRaw = firstProduct.variabilite_prix || firstProduct.price_variant;
                    if (variantRaw) {
                      // Si c'est un objet avec 'valeur', extraire la valeur
                      const variantValue = typeof variantRaw === 'object' && 'valeur' in variantRaw
                        ? variantRaw.valeur
                        : variantRaw;
                      if (variantValue) {
                        formValues.variabilite_prix = variantValue;
                        formValues.price_variant = variantValue;
                        console.log('[FormulaireYukpoIntelligentScreen] ✅ variabilite_prix chargé depuis produit:', variantValue);
                      }
                    }
                  }
                  // Extraire produits (autocomplete) si présent
                  if (firstProduct.produits !== undefined) {
                    const produitsValue = typeof firstProduct.produits === 'object' && 'valeur' in firstProduct.produits
                      ? firstProduct.produits.valeur
                      : firstProduct.produits;
                    if (produitsValue) {
                      formValues.produits = Array.isArray(produitsValue) ? produitsValue : [produitsValue];
                    }
                  }
                }
              }
            }

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
        navigateToBlockIndex(productsBlockIndex);
        console.log('[FormulaireYukpoIntelligentScreen] ✅ Bloc produits ouvert automatiquement (édition)');
      }

      // ✅ SUPPRIMÉ: Recherche produit - Les produits sont maintenant gérés via les champs dynamiques
    }
    // Cas 2: Création d'un nouveau produit (focusBlock uniquement)
    else if (focusBlock === 'products' && blocks.length > 0) {
      console.log('[FormulaireYukpoIntelligentScreen] 📦 Ouverture automatique du bloc produits pour création');
      const productsBlockIndex = blocks.findIndex(block => block.id === 'products');
      if (productsBlockIndex !== -1) {
        navigateToBlockIndex(productsBlockIndex);
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

      // ✅ CORRECTION : Gérer le cas où suggestion est vide ou mal formatée
      if (!suggestion || !suggestion.data || typeof suggestion.data !== 'object') {
        console.log('[FormulaireYukpoIntelligentScreen] Aucune donnée IA, génération composants par défaut');
        
        // Générer des composants par défaut
        const defaultSuggestion: IASuggestion = {};
        const components = processIASuggestion(defaultSuggestion);
        
        if (Array.isArray(components)) {
          const organizedBlocks = organizeFieldsIntoBlocks(components, {});
          setComposants(components);
          setBlocks(organizedBlocks);
          setActiveStep(2);
          setCurrentDisplayIndex(0);
          console.log('[FormulaireYukpoIntelligentScreen] ✅ Composants par défaut générés avec succès');
        } else {
          console.error('[FormulaireYukpoIntelligentScreen] ❌ processIASuggestion n\'a pas retourné un array (défaut)');
        }
        return;
      }

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
            else if (fieldName === 'prix_produit') {
              const valeur = fieldData.valeur;
              if (valeur !== null && valeur !== undefined && valeur !== '') {
                initialValues[fieldName] = valeur;
                console.log(`[FormulaireYukpoIntelligentScreen] ✅ Prix pré-rempli depuis l'IA pour ${fieldName}:`, valeur);
              }
            }
            // ✅ CORRIGÉ 2025-12-24: Devise déterminée automatiquement (comme dans AjouterProduitSimpleScreen)
            else if (fieldName === 'devise_produit') {
              // Ne pas pré-remplir ici, la devise sera déterminée automatiquement plus tard
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
        setBlocks(organizedBlocks);  // ✅ Utilise les valeurs IA !
        setValeursFormulaire(prev => ({
          ...prev, // Garder les contacts précédents
          ...initialValues, // Les données IA depuis suggestion.data
          ...componentValues // ✅ NOUVEAU: Les valeurs des field.value (nom_produit, etc.)
        }));
        setActiveStep(2); // Passer directement à l'étape 2 avec les données IA
        setCurrentDisplayIndex(0);
      } else {
        console.log('[FormulaireYukpoIntelligentScreen] Aucune donnée IA, rester à l\'étape 1');
      }
    } catch (error) {
      console.error('[FormulaireYukpoIntelligentScreen] ❌ ERREUR CRITIQUE dans useEffect suggestion:', error);
      // ✅ AMÉLIORATION : Logger l'erreur complète pour diagnostic
      console.error('[FormulaireYukpoIntelligentScreen] Détails erreur:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        suggestion: suggestion ? 'présent' : 'absent',
        suggestionData: suggestion?.data ? 'présent' : 'absent',
      });
      
      // ✅ AMÉLIORATION : Essayer de générer des composants par défaut en cas d'erreur
      try {
        console.log('[FormulaireYukpoIntelligentScreen] Tentative de récupération avec composants par défaut...');
        const defaultSuggestion: IASuggestion = {};
        const components = processIASuggestion(defaultSuggestion);
        
        if (Array.isArray(components)) {
          const organizedBlocks = organizeFieldsIntoBlocks(components, {});
          setComposants(components);
          setBlocks(organizedBlocks);
          setActiveStep(2);
          setCurrentDisplayIndex(0);
          console.log('[FormulaireYukpoIntelligentScreen] ✅ Récupération réussie avec composants par défaut');
          return; // Ne pas afficher l'alerte si la récupération fonctionne
        }
      } catch (fallbackError) {
        console.error('[FormulaireYukpoIntelligentScreen] ❌ Erreur lors de la récupération par défaut:', fallbackError);
      }
      
      // Ne pas crasher l'app, afficher un message d'erreur
      Alert.alert(
        'Erreur de chargement',
        'Impossible de charger les données du formulaire. Veuillez réessayer.',
        [{ text: 'OK', onPress: () => {
          // ✅ AMÉLIORATION : Retour automatique si l'utilisateur est venu de MesProduits
          if (fromMesProduits) {
            navigation.goBack();
          }
        }}]
      );
    }
  }, [suggestion, fromMesProduits, navigation]); // Se déclenche quand suggestion change


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
          navigateToBlockIndex(productsBlockIndex);
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


  // ✅ NOUVEAU : Scroll automatique vers le bloc produits si focusBlock === 'produits'
  useEffect(() => {
    if (focusBlock === 'produits' && blocks.length > 0 && activeStep === 2) {
      // Trouver l'index du bloc produits
      const productsBlockIndex = blocks.findIndex(block => block.id === 'products');

      if (productsBlockIndex >= 0) {
        console.log('[FormulaireYukpoIntelligentScreen] 📦 Navigation automatique vers le bloc produits, index:', productsBlockIndex);

        // Attendre un peu que les blocs soient rendus
        setTimeout(() => {
          navigateToBlockIndex(productsBlockIndex);
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
        setValeursFormulaire({
          ...initialValues,
          ...componentValues // ✅ NOUVEAU: Les valeurs des field.value
        });
        setComposants(components);
        setBlocks(organizedBlocks);  // ✅ Utilise les valeurs IA !
        setActiveStep(2);
        setCurrentDisplayIndex(0);
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
        setCurrentDisplayIndex(0);
      }

    } catch (error) {
      console.error('[FormulaireYukpoIntelligentScreen] Erreur génération:', error);
      Alert.alert('Erreur', 'Impossible de générer le formulaire');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NOUVEAU: Refs pour stocker temporairement les valeurs pendant la saisie (évite les re-renders)
  const pendingValuesRef = React.useRef<Record<string, any>>({});
  const debounceTimeoutsRef = React.useRef<Record<string, NodeJS.Timeout>>({});

  // ✅ NOUVEAU: Nettoyer les timeouts au démontage du composant
  React.useEffect(() => {
    return () => {
      // Nettoyer tous les timeouts en cours
      Object.values(debounceTimeoutsRef.current).forEach(timeout => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
      debounceTimeoutsRef.current = {};
      pendingValuesRef.current = {};
    };
  }, []);

  // Gérer les changements de champs
  // ✅ CORRECTION CRITIQUE: Utiliser debounce pour éviter les re-renders qui font sauter le curseur
  const handleFieldChange = React.useCallback((fieldName: string, value: any) => {
    // Convertir automatiquement les prix en nombres
    let processedValue = value;
    if (fieldName === 'prix' && typeof value === 'string' && value.trim() !== '') {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        processedValue = numericValue;
      }
    }

    // ✅ NOUVEAU: Stocker la valeur temporairement pour l'affichage immédiat
    pendingValuesRef.current[fieldName] = processedValue;

    // ✅ NOUVEAU: Annuler le timeout précédent pour ce champ
    if (debounceTimeoutsRef.current[fieldName]) {
      clearTimeout(debounceTimeoutsRef.current[fieldName]);
    }

    // ✅ CORRECTION CRITIQUE: Débouncer la mise à jour de l'état pour éviter les re-renders fréquents
    // Pour les champs texte simples, utiliser un délai de 300ms (augmenté pour éviter les sauts de curseur)
    // Pour les autres champs (select, checkbox, etc.), mettre à jour immédiatement
    const isTextInput = typeof processedValue === 'string';
    const debounceDelay = isTextInput ? 300 : 0; // ✅ AUGMENTÉ: De 150ms à 300ms pour plus de stabilité

    debounceTimeoutsRef.current[fieldName] = setTimeout(() => {
      setValeursFormulaire(prev => {
        // ✅ Vérifier si la valeur a changé depuis le dernier rendu pour éviter les re-renders inutiles
        if (prev[fieldName] === processedValue) {
          return prev;
        }
        return {
      ...prev,
      [fieldName]: processedValue
        };
      });
      // Nettoyer la valeur temporaire après la mise à jour
      delete pendingValuesRef.current[fieldName];
      delete debounceTimeoutsRef.current[fieldName];
    }, debounceDelay);
  }, []);

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

  // ✅ CORRIGÉ: Mémoriser renderField avec useCallback pour éviter les re-renders qui font sauter le curseur
  const renderField = React.useCallback((field: DynamicField) => {
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

      // ✅ NOUVEAU: Extraire productLabels pour garantir l'ordre correct des labels
      let productLabels: string[] | undefined = undefined;
      if (fieldValue && typeof fieldValue === 'object' && 'product_labels' in fieldValue) {
        const labels = fieldValue.product_labels;
        if (Array.isArray(labels) && labels.length > 0) {
          productLabels = labels.filter((label: any) => typeof label === 'string' && label.trim().length > 0);
        }
      } else if (valeursFormulaire.product_labels && Array.isArray(valeursFormulaire.product_labels)) {
        productLabels = valeursFormulaire.product_labels.filter((label: any) => typeof label === 'string' && label.trim().length > 0);
      } else if (Object.keys(currentSousCaracs).length > 0) {
        // ✅ CORRECTION: Fallback - essayer d'utiliser product_labels depuis valeursFormulaire si disponible
        // Sinon, utiliser Object.keys (mais ce n'est pas idéal car l'ordre n'est pas garanti)
        if (valeursFormulaire.product_labels && Array.isArray(valeursFormulaire.product_labels)) {
          productLabels = valeursFormulaire.product_labels.filter((label: any) => typeof label === 'string' && label.trim().length > 0 && currentSousCaracs[label]);
        } else {
          // Dernier recours: utiliser Object.keys (ordre non garanti)
          productLabels = Object.keys(currentSousCaracs);
          console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Utilisation Object.keys() pour productLabels - ordre non garanti');
        }
      }

      const nbModalites = currentValues.length;
      const nbCaracteristiques = Object.keys(currentSousCaracs).length;

      console.log('[FormulaireYukpoIntelligentScreen] ✅ Rendu autocomplete pour:', field.name, {
        nbModalites,
        nbCaracteristiques,
        currentValues,
        nbSousCaracsDisponibles: Object.keys(currentSousCaracs).length,
        separateur: safeSeparateur,
        productLabels: productLabels || 'non disponible'
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

          <LinearAutocompleteEditor
            label={field.label}
            identifiantBase={field.identifiantBase || field.name || 'produit'}
            sousCaracteristiques={currentSousCaracs || {}} // ✅ PROTECTION: Garantir objet valide
            separateur={safeSeparateur} // ✅ PROTECTION ULTIME: Garantit string valide
            value={currentValues || []} // ✅ PROTECTION: Garantir array de strings valides
            productLabels={productLabels} // ✅ NOUVEAU: Passer productLabels pour garantir l'ordre correct
            contextValues={[
              valeursFormulaire.categorie_produit,
              valeursFormulaire.category,
              valeursFormulaire.description_produit,
              valeursFormulaire.description,
              valeursFormulaire.nom_produit,
              valeursFormulaire.titre_service,
            ]}
            categoryValue={valeursFormulaire.categorie_produit || valeursFormulaire.category || ''}
            onChange={(values, updatedSousCaracs) => {
              // ✅ NOUVEAU 2025-11-04: Mettre à jour aussi sous-caractéristiques si modifiées
              // ✅ CORRECTION 2026-01-XX: Synchronisation automatique prix_variation <-> sous-caractéristiques
              // (comme dans AjouterProduitSimpleScreen pour garantir la cohérence)
              const updatedProduitsValue = {
                type_donnee: 'autocomplete',
                valeur: values,
                separateur: safeSeparateur,
                sous_caracteristiques: updatedSousCaracs || currentSousCaracs,
                identifiant_base: field.identifiantBase || field.name,
                filtrable: field.filtrable !== false,
                origine_champs: 'formulaire'
              };

              // ✅ NOUVEAU: Extraire et synchroniser automatiquement les prix_variation depuis les produits
              // (comme dans AjouterProduitSimpleScreen)
              const normalizedPriceVariant = extractPriceVariant(
                updatedProduitsValue,
                updatedProduitsValue.origine_champs || 'formulaire'
              );

              // Mettre à jour le champ produits
              handleFieldChange(field.name, updatedProduitsValue);

              // ✅ NOUVEAU: Si des prix_variation sont détectés, les synchroniser automatiquement
              if (normalizedPriceVariant) {
                // Trouver le champ price_variant correspondant (variabilite_prix ou price_variant)
                const priceVariantFieldName = Object.keys(valeursFormulaire).find(
                  key => key === 'variabilite_prix' || key === 'price_variant' || key === 'variation_prix'
                ) || 'variabilite_prix';

                handleFieldChange(priceVariantFieldName, {
                  type_donnee: 'price_variant',
                  variable: normalizedPriceVariant.variable,
                  modalites: normalizedPriceVariant.modalites,
                  filtrable: normalizedPriceVariant.filtrable !== false,
                  origine_champs: normalizedPriceVariant.origine_champs || 'formulaire'
                });

                // ✅ NOUVEAU: Inférer automatiquement la devise depuis les prix_variation
                const inferredCurrency = getCurrencyFromVariant(normalizedPriceVariant);
                if (inferredCurrency) {
                  handleFieldChange('devise_produit', inferredCurrency);
                  handleFieldChange('devise', inferredCurrency);
                }

                console.log('[FormulaireYukpoIntelligentScreen] ✅ Prix_variation synchronisés depuis produits:', normalizedPriceVariant);
              } else {
                // Si pas de prix_variation détectés, vérifier s'il faut les supprimer
                const existingPriceVariant = valeursFormulaire.variabilite_prix || valeursFormulaire.price_variant;
                if (existingPriceVariant && !extractPriceVariant(updatedProduitsValue)) {
                  // Ne pas supprimer automatiquement - laisser l'utilisateur gérer manuellement
                  console.log('[FormulaireYukpoIntelligentScreen] ⚠️ Prix_variation existants non synchronisés avec nouveaux produits');
                }
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
      // ✅ CORRECTION: Vérifier les deux noms possibles (variabilite_prix et price_variant)
      // comme dans AjouterProduitSimpleScreen pour garantir la récupération des modalités
      const userModalites = 
        valeursFormulaire[field.name]?.modalites ||
        valeursFormulaire['variabilite_prix']?.modalites ||
        valeursFormulaire['price_variant']?.modalites;
      const modalitesFromUser = Array.isArray(userModalites) ? userModalites : [];
      const modalitesToRender = modalitesFromUser.length > 0 ? modalitesFromUser : iaModalites;

      // ✅ CORRECTION: Ne pas retourner null si les modalités sont vides
      // Permettre l'affichage du composant même sans modalités pour permettre l'ajout manuel
      // (comme dans AjouterProduitSimpleScreen qui affiche toujours si hasExistingVariants est true)
      // Mais si ni les modalités IA ni les modalités utilisateur n'existent, on peut afficher le composant vide
      // pour permettre à l'utilisateur d'ajouter des variantes manuellement

      const typeOffre = (valeursFormulaire.type_offre || 'produit').toLowerCase();
      const isProduitPhysique = typeOffre === 'produit' || typeOffre === 'vente';

      return (
        <View key={field.name} style={styles.fieldContainer}>
          <PriceVariantSelector
            label={field.label || (isProduitPhysique ? 'Variantes produit' : 'Variantes prestation')}
            variable={field.variable || (isProduitPhysique ? 'option' : 'formule')}
            modalites={modalitesToRender}
            onChange={(modalites) => {
              // ✅ CORRECTION 2026-01-XX: Synchronisation automatique prix_variation <-> sous-caractéristiques
              // (comme dans AjouterProduitSimpleScreen pour garantir la cohérence)
              const normalizedPriceVariant = extractPriceVariant({
                type_donnee: 'price_variant',
                variable: field.variable || (isProduitPhysique ? 'option' : 'formule'),
                modalites,
                filtrable: field.filtrable !== false,
                origine_champs: 'formulaire'
              }, 'formulaire');

              // Mettre à jour le champ price_variant
              handleFieldChange(field.name, {
                type_donnee: 'price_variant',
                variable: field.variable || (isProduitPhysique ? 'option' : 'formule'),
                modalites,
                filtrable: field.filtrable !== false,
                origine_champs: 'formulaire'
              });

              // ✅ NOUVEAU: Synchroniser automatiquement avec le champ produits (autocomplete) si disponible
              // Trouver le champ produits correspondant
              const produitsFieldName = Object.keys(valeursFormulaire).find(
                key => {
                  const fieldValue = valeursFormulaire[key];
                  return fieldValue && typeof fieldValue === 'object' && 
                         (fieldValue.type_donnee === 'autocomplete' || key === 'produits');
                }
              );

              if (produitsFieldName && normalizedPriceVariant) {
                const existingProduits = valeursFormulaire[produitsFieldName];
                if (existingProduits && typeof existingProduits === 'object') {
                  // ✅ NOUVEAU: Appliquer les prix_variation aux produits (comme dans AjouterProduitSimpleScreen)
                  const updatedProduits = applyPriceVariantToProduits(existingProduits, normalizedPriceVariant);
                  if (updatedProduits !== existingProduits) {
                    handleFieldChange(produitsFieldName, updatedProduits);
                    console.log('[FormulaireYukpoIntelligentScreen] ✅ Produits synchronisés avec prix_variation:', updatedProduits);
                  }
                }
              }

              // ✅ NOUVEAU: Inférer automatiquement la devise depuis les prix_variation
              if (normalizedPriceVariant) {
                const inferredCurrency = getCurrencyFromVariant(normalizedPriceVariant);
                if (inferredCurrency) {
                  handleFieldChange('devise_produit', inferredCurrency);
                  handleFieldChange('devise', inferredCurrency);
                }
              }
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
      // ✅ NOUVEAU: Rendu spécial pour lieu_produit avec ModernGPSModal
      if (field.name === 'lieu_produit' || field.name === 'lieu_commercial' || field.name === 'lieu_commercialisation') {
        const currentValue = valeursFormulaire[field.name]?.valeur || valeursFormulaire[field.name] || '';
        // Extraire le nom complet du lieu (place_name) au lieu de seulement la ville
        const displayText = typeof currentValue === 'object' && currentValue !== null
          ? (currentValue.place_name || currentValue.raw || '')
          : (typeof currentValue === 'string' ? currentValue : '');
        
        const isEmpty = !displayText || displayText.trim() === '';
        const isRequired = field.required === true;
        
        return (
          <View key={field.name} style={[
            styles.fieldContainer,
            isEmpty && isRequired && styles.fieldContainerRequired // ✅ AMÉLIORÉ: Style spécial si requis et vide
          ]}>
            {/* ✅ AMÉLIORÉ 2026-01-12: Label plus visible avec icône et badge requis */}
            <View style={styles.locationLabelContainer}>
              <SafeIcon name="map-pin" size={18} color={isRequired && isEmpty ? modernColors.error : modernColors.primary} />
              <Text style={[
                styles.label,
                isRequired && isEmpty && styles.labelRequired // ✅ Style spécial si requis et vide
              ]}>
                {field.label}
                {isRequired && <Text style={styles.required}> *</Text>}
              </Text>
              {isRequired && isEmpty && (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredBadgeText}>OBLIGATOIRE</Text>
                </View>
              )}
            </View>
            
            {/* ✅ AMÉLIORÉ: Bouton plus visible avec bordure et fond si vide */}
            <TouchableOpacity
              style={[
                styles.select,
                isEmpty && styles.selectEmpty, // ✅ Style spécial si vide
                isEmpty && isRequired && styles.selectRequiredEmpty // ✅ Style encore plus visible si requis et vide
              ]}
              onPress={() => {
                // Récupérer la localisation actuelle si disponible
                const currentValue = valeursFormulaire[field.name]?.valeur || valeursFormulaire[field.name];
                if (typeof currentValue === 'object' && currentValue !== null && currentValue.coordinates) {
                  setSelectedLocation({ lat: currentValue.coordinates.lat, lng: currentValue.coordinates.lng });
                } else {
                  setSelectedLocation(null);
                }
                setGpsModalForField(field.name);
                setShowGPSModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.selectContent}>
                <SafeIcon 
                  name="map-pin" 
                  size={22} 
                  color={isEmpty && isRequired ? modernColors.error : modernColors.primary} 
                />
                <Text style={[
                  styles.selectText, 
                  isEmpty && styles.selectPlaceholderText,
                  isEmpty && isRequired && styles.selectRequiredText // ✅ Texte plus visible si requis et vide
                ]}>
                  {displayText || field.placeholder || '📍 Cliquez pour sélectionner un lieu...'}
                </Text>
              </View>
              <SafeIcon name="chevron-right" size={20} color={isEmpty && isRequired ? modernColors.error : modernColors.textSecondary} />
            </TouchableOpacity>
            
            {/* ✅ AMÉLIORÉ: Message d'aide plus visible si le champ est vide et requis */}
            {isEmpty && isRequired ? (
              <View style={styles.alertBox}>
                <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                <Text style={styles.alertText}>
                  <Text style={styles.alertBold}>Champ obligatoire :</Text> Veuillez sélectionner le lieu de commercialisation de votre produit pour permettre aux clients de vous localiser.
                </Text>
              </View>
            ) : (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                  💡 <Text style={styles.hintBold}>Sélection GPS :</Text> Cliquez pour ouvrir la carte et sélectionner ou créer un lieu précis. Le nom complet du lieu sera affiché.
                </Text>
              </View>
            )}
            {fieldErrors[field.name] && (
              <Text style={styles.fieldErrorText}>⚠️ {String(fieldErrors[field.name])}</Text>
            )}
          </View>
        );
      }
      
      // Rendu normal pour les autres champs location
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
            placeholder={field.placeholder}
            // ✅ EXPLICITE: Déterminer le scope basé sur le label du champ (robuste même si label mal formaté)
            scope={
              field.label?.toLowerCase().includes('quartier') || field.label?.toLowerCase().includes('zone') || field.label?.toLowerCase().includes('neighborhood')
                ? 'neighborhood'
                : field.label?.toLowerCase().includes('ville') || field.label?.toLowerCase().includes('city')
                ? 'city'
                : field.label?.toLowerCase().includes('pays') || field.label?.toLowerCase().includes('country')
                ? 'all'
                : 'all' // Par défaut: recherche universelle pour "lieu" et autres
            }
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
        
        // ✅ CORRECTION: Déterminer le keyboardType approprié pour les champs email et url
        const keyboardType = field.type === 'email' || field.name === 'email' 
          ? 'email-address' 
          : (field.type === 'url' || field.name === 'website' ? 'default' : 'default');

        // ✅ CORRECTION CRITIQUE: Extraire la valeur AVANT le JSX pour éviter les re-renders
        // ✅ NOUVEAU: Utiliser la valeur temporaire si disponible (pendant la saisie) pour éviter les sauts de curseur
        const rawValue = pendingValuesRef.current[field.name] !== undefined 
          ? pendingValuesRef.current[field.name] 
          : valeursFormulaire[field.name];
        let fieldValue = '';
        if (rawValue) {
          if (typeof rawValue === 'string') {
            fieldValue = rawValue;
          } else if (typeof rawValue === 'object' && rawValue !== null) {
            // Si c'est un objet avec une propriété 'valeur', l'utiliser
            if ('valeur' in rawValue && typeof rawValue.valeur === 'string') {
              fieldValue = rawValue.valeur;
            }
            // Sinon, essayer de convertir en string
            else if ('raw' in rawValue && typeof rawValue.raw === 'string') {
              fieldValue = rawValue.raw;
            }
            // Dernier recours: convertir en string
            else {
              fieldValue = String(rawValue);
            }
          } else {
            fieldValue = String(rawValue);
          }
        }

        return (
          <View key={field.name} style={isProductField ? styles.productFieldContainer : styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <StableTextInput
              key={`input-${field.name}`}
              placeholder={field.placeholder}
              value={fieldValue}
              onChangeText={(text) => {
                // ✅ CORRECTION CRITIQUE: Utiliser StableTextInput qui gère l'état local
                // Cela évite les re-renders pendant la saisie qui causent les sauts de curseur
                handleFieldChange(field.name, text);
              }}
              onBlur={() => {
                // ✅ CORRECTION CRITIQUE: Effacer l'erreur seulement lors du blur (quand l'utilisateur quitte le champ)
                if (hasError) {
                  setFieldErrors(prev => {
                    if (!prev[field.name]) return prev;
                    const newErrors = { ...prev };
                    delete newErrors[field.name];
                    return newErrors;
                  });
                }
              }}
              keyboardType={keyboardType}
              autoCapitalize={field.type === 'email' || field.type === 'url' ? 'none' : 'sentences'}
              autoCorrect={field.type === 'email' || field.type === 'url' ? false : true}
              debounceMs={300}
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
        // ✅ REFONTE COMPLÈTE: Utiliser le même comportement pour tous les textarea (description et description_produit)
        // ✅ CORRECTION: Extraire la valeur AVANT le JSX pour éviter les re-renders
        // ✅ NOUVEAU: Utiliser la valeur temporaire si disponible (pendant la saisie) pour éviter les sauts de curseur
        const textareaRawValue = pendingValuesRef.current[field.name] !== undefined 
          ? pendingValuesRef.current[field.name] 
          : valeursFormulaire[field.name];
        let textareaValue = '';
        if (textareaRawValue) {
          if (typeof textareaRawValue === 'string') {
            textareaValue = textareaRawValue;
          } else if (typeof textareaRawValue === 'object' && textareaRawValue !== null) {
            if ('valeur' in textareaRawValue && typeof textareaRawValue.valeur === 'string') {
              textareaValue = textareaRawValue.valeur;
            }
            else if ('raw' in textareaRawValue && typeof textareaRawValue.raw === 'string') {
              textareaValue = textareaRawValue.raw;
            }
            else {
              textareaValue = String(textareaRawValue);
            }
          } else {
            textareaValue = String(textareaRawValue);
          }
        }
        
        // ✅ REFONTE: Utiliser les mêmes paramètres pour tous les textarea (comme description)
        // ✅ CORRECTION CRITIQUE: Utiliser minimum 4 lignes pour description_produit pour permettre un meilleur affichage
        const linesMinimum = field.name === 'description_produit' 
          ? Math.max(field.minLines || 4, 4)  // Minimum 4 lignes pour description_produit
          : (field.minLines || 3); // 3 lignes pour description standard
        
        // ✅ CORRECTION CRITIQUE: S'assurer que description_produit a les mêmes styles et comportement que description
        const isProductDescription = field.name === 'description_produit';
        
        return (
          <View key={field.name} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <NativeInput
              placeholder={field.placeholder}
              value={textareaValue}
              onChangeText={(text) => handleFieldChange(field.name, text)}
              multiline={true}
              minLines={linesMinimum}
              style={[
                styles.fieldInput,
                styles.textareaInput,
                // ✅ CORRECTION CRITIQUE: S'assurer que description_produit a une hauteur suffisante
                isProductDescription && {
                  minHeight: 120, // Hauteur minimale pour description_produit (4 lignes * 24px + padding)
                  maxHeight: undefined, // Pas de limite maximale pour permettre la croissance
                }
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
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => {
                    Alert.alert(
                      'Sélectionner la devise',
                      'Choisissez la devise du prix',
                      [
                        { text: 'XAF (Franc CFA)', onPress: () => handleFieldChange('devise', 'XAF') },
                        { text: 'EUR (Euro)', onPress: () => handleFieldChange('devise', 'EUR') },
                        { text: 'USD (Dollar)', onPress: () => handleFieldChange('devise', 'USD') },
                        { text: 'GBP (Livre)', onPress: () => handleFieldChange('devise', 'GBP') },
                        { text: 'CAD (Dollar canadien)', onPress: () => handleFieldChange('devise', 'CAD') },
                        { text: 'CHF (Franc suisse)', onPress: () => handleFieldChange('devise', 'CHF') },
                        { text: 'Annuler', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <Text style={styles.pickerButtonText}>
                    {valeursFormulaire.devise || 'XAF'}
                  </Text>
                  <SafeIcon name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
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
  }, [valeursFormulaire, fieldErrors, isReadonly, handleFieldChange, updateProductImages, updateProductVideos, mediaFiles, primaryProductImage, setFieldErrors, setShowGPSModal, setGpsModalForField, setSelectedLocation, setShowProductDeliveryConfig, setProductDeliveryConfigData, getCurrencyFromVariant]);

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

      const mergeMediaArrays = (existing: any, incoming: any, maxImages?: number): any[] => {
        const base = Array.isArray(incoming) ? incoming : [];
        const current = Array.isArray(existing) ? existing : [];
        const merged = [...base, ...current];
        const unique = merged.filter(Boolean).filter((value, index, self) => self.indexOf(value) === index);
        // ✅ CORRECTION: Limiter les images si maxImages est spécifié (pour respecter la limite backend de 10)
        if (maxImages !== undefined && unique.length > maxImages) {
          console.warn(`[FormulaireYukpoIntelligentScreen] ⚠️ ${unique.length} images détectées, limitées à ${maxImages} (maximum backend)`);
          return unique.slice(0, maxImages);
        }
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
            // ✅ CORRECTION: Limiter à 10 images maximum (limite backend)
            images: Array.isArray(media.images) ? media.images.slice(0, 10) : [],
            base64_image: Array.isArray(media.images) ? media.images.slice(0, 10) : [],
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
              // ✅ CORRECTION: Limiter à 10 images maximum (limite backend)
              const limitedImages = mergedImages.slice(0, 10);
              if (limitedImages.length > 0) {
                firstProduct.images = limitedImages;
                firstProduct.base64_image = limitedImages;
              }
              if (mergedImages.length > 10) {
                console.warn(`[FormulaireYukpoIntelligentScreen] ⚠️ ${mergedImages.length} images détectées, limitées à 10 (maximum backend)`);
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
            // ✅ CORRIGÉ: Convertir le prix en nombre au lieu de le garder comme chaîne
            if (key === 'prix_produit' || key === 'prix') {
              const trimmed = String(value).trim();
              if (trimmed.length > 0 && !isNaN(Number(trimmed))) {
                const prixNumber = Number(trimmed);
                nouveauProduit[key] = isNaN(prixNumber) ? null : prixNumber;
              }
            } else {
              nouveauProduit[key] = value;
            }
          }
        });

        const compressedMedia = await getCompressedMedia();

        if (compressedMedia?.images?.length) {
          // ✅ CORRECTION: Limiter à 10 images maximum (limite backend)
          const mergedImages = mergeMediaArrays(nouveauProduit.images, compressedMedia.images, 10);
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
                if (fromMesProduits || isEditingServiceInfo) {
                  // Retour vers Mes Produits
                  navigation.goBack();
                } else if (fromMesServices) {
                  (navigation as any).navigate('MesServices');
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

          // ✅ CORRIGÉ: Construire les données COMPLÈTES du nouveau produit (IDENTIQUE À AjouterProduitSimpleScreen)
          const nouveauProduit: Record<string, any> = {};

          // ✅ Liste complète des champs produits à extraire (IDENTIQUE À AjouterProduitSimpleScreen)
          const PRODUCT_FIELDS = [
            'nom_produit',
            'categorie_produit',
            'description_produit',
            'produits',  // Autocomplete caractéristiques
            'prix',
            'prix_produit',
            'devise',
            'devise_produit',
            'lieu_produit',
            'lieu_commercial',
            'lieu_commercialisation',
            'price_variant',   // ✅ Variations de prix
            'variabilite_prix', // Alias de price_variant
            'product_labels',   // ✅ Labels/tags
            'images',           // ✅ Images produit
            'videos',           // ✅ Vidéos produit
            'audios',           // Éventuellement
            'documents'         // Éventuellement
          ];

          PRODUCT_FIELDS.forEach(key => {
            const value = valeursFormulaire[key];
            // ✅ CORRECTION: Filtrer explicitement les chaînes vides pour prix
            if (key === 'prix_produit' || key === 'prix') {
              if (value !== undefined && value !== null && value !== '') {
                const trimmed = String(value).trim();
                if (trimmed.length > 0 && !isNaN(Number(trimmed))) {
                  // ✅ CORRIGÉ: Convertir le prix en nombre au lieu de le garder comme chaîne
                  const prixNumber = Number(trimmed);
                  nouveauProduit[key] = isNaN(prixNumber) ? null : prixNumber;
                }
              }
            } else if (value !== undefined && value !== null && value !== '') {
              nouveauProduit[key] = value;
            }
          });

          // ✅ Ajouter le stock si quantite_disponible est défini
          if (valeursFormulaire.quantite_disponible !== null && valeursFormulaire.quantite_disponible !== undefined && valeursFormulaire.quantite_disponible !== '') {
            const stockValue = typeof valeursFormulaire.quantite_disponible === 'number'
              ? valeursFormulaire.quantite_disponible
              : parseInt(String(valeursFormulaire.quantite_disponible), 10);
            if (!isNaN(stockValue) && stockValue >= 0) {
              nouveauProduit.stock = stockValue;
              nouveauProduit.quantite_disponible = stockValue; // Alias pour compatibilité
            }
          }

          // ✅ CRITIQUE: Construire characteristic_vector et combinaison_brute (IDENTIQUE À AjouterProduitSimpleScreen)
          const combinationString = (() => {
            if (Array.isArray(valeursFormulaire.produits)) {
              const firstString = valeursFormulaire.produits.find((entry: any) => typeof entry === 'string');
              if (typeof firstString === 'string') {
                return firstString;
              }
            }
            if (typeof valeursFormulaire.produits === 'string') {
              return valeursFormulaire.produits;
            }
            if (Array.isArray(valeursFormulaire.nominalVector)) {
              const firstString = valeursFormulaire.nominalVector.find((entry: any) => typeof entry === 'string');
              if (typeof firstString === 'string') {
                return firstString;
              }
            }
            return '';
          })();

          if (combinationString) {
            nouveauProduit.combinaison_brute = combinationString;
            const characteristicVector = combinationString
              .split(',')
              .map((part: string) => part.trim())
              .filter((part: string) => part.length > 0);
            if (characteristicVector.length > 0) {
              nouveauProduit.characteristic_vector = characteristicVector;
            }
          }

          // ✅ CORRECTION: Inclure sous_caracteristiques dans le payload (OBJET COMPLET avec valeurs)
          // Les sous-caractéristiques peuvent être dans valeursFormulaire.produits.sous_caracteristiques (objet complexe) ou valeursFormulaire.sous_caracteristiques (direct)
          const sousCaracteristiques = (() => {
            // 1. Vérifier si produits est un objet complexe avec sous_caracteristiques
            if (valeursFormulaire.produits && typeof valeursFormulaire.produits === 'object' && 'sous_caracteristiques' in valeursFormulaire.produits) {
              return valeursFormulaire.produits.sous_caracteristiques;
            }
            // 2. Vérifier directement dans valeursFormulaire
            if (valeursFormulaire.sous_caracteristiques && typeof valeursFormulaire.sous_caracteristiques === 'object') {
              return valeursFormulaire.sous_caracteristiques;
            }
            return null;
          })();

          if (sousCaracteristiques && typeof sousCaracteristiques === 'object') {
            nouveauProduit.sous_caracteristiques = sousCaracteristiques;
            
            // Garder aussi product_labels pour compatibilité (clés uniquement)
            if (!nouveauProduit.product_labels) {
              // ✅ CORRECTION: Prioriser product_labels depuis valeursFormulaire si disponible (ordre garanti)
              if (valeursFormulaire.product_labels && Array.isArray(valeursFormulaire.product_labels)) {
                nouveauProduit.product_labels = valeursFormulaire.product_labels.filter((label: any) => typeof label === 'string' && label.trim().length > 0);
              } else {
                // Fallback: utiliser Object.keys (ordre non garanti)
                nouveauProduit.product_labels = Object.keys(sousCaracteristiques || {});
                console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Utilisation Object.keys() pour product_labels - ordre non garanti');
              }
            }
          }

          if (!nouveauProduit.origine_champs) {
            nouveauProduit.origine_champs = 'formulaire';
          }

          // ✅ NOUVEAU: Transformer variation_prix en format variants/has_variant pour ProductCard
          const priceVariant = nouveauProduit.variabilite_prix || nouveauProduit.price_variant || nouveauProduit.variation_prix;
          if (priceVariant && typeof priceVariant === 'object' && !Array.isArray(priceVariant)) {
            const modalites = priceVariant.modalites || priceVariant.valeur || priceVariant;
            if (Array.isArray(modalites) && modalites.length > 0) {
              const variants = modalites.map((modalite: any) => {
                const variant: any = {};
                if (modalite.valeur || modalite.value) {
                  variant.value = modalite.valeur || modalite.value;
                  variant.valeur = modalite.valeur || modalite.value;
                }
                if (modalite.prix !== undefined || modalite.price !== undefined) {
                  variant.prix = modalite.prix || modalite.price;
                }
                if (modalite.devise || modalite.currency) {
                  variant.devise = modalite.devise || modalite.currency;
                }
                if (modalite.stock !== undefined || modalite.quantite !== undefined) {
                  variant.stock = modalite.stock || modalite.quantite;
                }
                if (modalite.image) {
                  variant.image = modalite.image;
                }
                return variant;
              });

              nouveauProduit.has_variant = true;
              nouveauProduit.variants = variants;

              if (priceVariant.variable) {
                nouveauProduit.variant_dimension = priceVariant.variable;
              }

              console.log('[FormulaireYukpoIntelligentScreen] ✅ Variations de prix transformées en variants:', variants.length);
            }
          }

          console.log('[FormulaireYukpoIntelligentScreen] 📦 Données du nouveau produit (complètes):', {
            ...nouveauProduit,
            has_variant: nouveauProduit.has_variant,
            variants_count: nouveauProduit.variants ? nouveauProduit.variants.length : 0,
            characteristic_vector: nouveauProduit.characteristic_vector?.length || 0
          });

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

                  if (fromMesProduits) {
                    (navigation as any).navigate('MesProduits');
                  } else if (fromMesServices) {
                    (navigation as any).navigate('MesServices');
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
                  // ✅ CORRIGÉ: Convertir le prix en nombre (peut être une chaîne depuis le formulaire)
                  const prixProduitRaw = finalServiceData.prix_produit?.valeur || valeursFormulaire.prix_produit || 0;
                  const prixProduit = typeof prixProduitRaw === 'string' ? (prixProduitRaw.trim() ? Number(prixProduitRaw.trim()) : 0) : (prixProduitRaw || 0);
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
                    return ',';
                  })();

                  characteristicVector = combinationString
                    ? combinationString.split(effectiveSeparator).map((part) => part.trim()).filter(Boolean)
                    : [];

                  productLabelsFromAutocomplete = (() => {
                    // ✅ CORRECTION: Prioriser product_labels depuis autocompleteData ou valeursFormulaire (ordre garanti)
                    if (autocompleteData?.product_labels && Array.isArray(autocompleteData.product_labels)) {
                      return autocompleteData.product_labels.filter((label: any) => typeof label === 'string' && label.trim().length > 0);
                    }
                    if (Array.isArray(valeursFormulaire?.product_labels)) {
                      return valeursFormulaire.product_labels.filter((label: any) => typeof label === 'string' && label.trim().length > 0);
                    }
                    // Fallback: utiliser Object.keys depuis sous_caracteristiques (ordre non garanti)
                    if (autocompleteData?.sous_caracteristiques && typeof autocompleteData.sous_caracteristiques === 'object') {
                      const keys = Object.keys(autocompleteData.sous_caracteristiques || {});
                      console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Utilisation Object.keys() pour productLabelsFromAutocomplete - ordre non garanti');
                      return keys;
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
                    // ✅ CORRECTION: Limiter à 10 images maximum (limite backend)
                    const mergedImages = mergeMediaArrays(produitObj.images, compressedMedia.images, 10);
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

                // ✅ NOUVEAU: Émettre un événement pour rafraîchir les produits
                // ✅ CORRECTION: Ajouter un délai pour laisser la base de données se mettre à jour
                setTimeout(() => {
                  DeviceEventEmitter.emit('service:refresh');
                  DeviceEventEmitter.emit('product:created');
                }, 2000);

                // ✅ Marquer la soumission comme terminée
                setIsSubmitting(false);
                setLoading(false);

                // ✅ NOUVEAU: Si c'est un produit (pas une prestation), préparer l'ouverture de la configuration de livraison
                const typeOffre = valeursFormulaire.type_offre || finalServiceData.type_offre?.valeur || 'produit';
                const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';
                const serviceIdCreated = result?.id || result?.service_id;
                
                // Vérifier si le service a des produits
                const hasProducts = finalServiceData.produits && 
                  finalServiceData.produits.type_donnee === 'listeproduit' &&
                  Array.isArray(finalServiceData.produits.valeur) &&
                  finalServiceData.produits.valeur.length > 0;
                
                if (!isPrestation && hasProducts && serviceIdCreated) {
                  // C'est un produit, préparer les données pour la modal de confirmation
                  const firstProductIndex = 0;
                  const firstProduct = finalServiceData.produits.valeur[0];
                  const productName = firstProduct?.nom || valeursFormulaire.nom_produit || 'Nouveau produit';
                  
                  // Afficher la modal de confirmation
                  setSuccessModalData({
                    serviceId: typeof serviceIdCreated === 'number' ? serviceIdCreated : parseInt(String(serviceIdCreated), 10),
                    productIndex: firstProductIndex,
                    productName: productName,
                    isPrestation: false,
                    cout: coutReel,
                  });
                  setShowSuccessModal(true);
                  return; // Ne pas rediriger vers Home/MesServices si on affiche la modal
                } else {
                  // C'est une prestation ou pas de produits, afficher juste la modal de confirmation
                  setSuccessModalData({
                    serviceId: typeof serviceIdCreated === 'number' ? serviceIdCreated : parseInt(String(serviceIdCreated), 10),
                    productIndex: -1,
                    productName: 'Service',
                    isPrestation: true,
                    cout: coutReel,
                  });
                  setShowSuccessModal(true);
                }

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
          title={
            activeStep === 2 && blocks.length > 0 && blocks[currentBlock]
              ? blocks[currentBlock].title
              : isReadonly ? 'Consultation' : mode === 'edit' ? 'Modification' : 'Formulaire Intelligent'
          }
          subtitle={
            activeStep === 2 && blocks.length > 0 && blocks[currentBlock]
              ? `${currentDisplayIndex + 1} / ${totalVisibleBlocks}`
              : isReadonly ? 'Mode lecture seule' : mode === 'edit' ? 'Modification en cours' : 'Propulsé par l\'IA Yukpo'
          }
          onClose={handleGoBack}
        />
      </LinearGradient>

      <View style={styles.scrollView}>
        {/* Étape 1: Génération du formulaire */}
        {activeStep === 1 && (
          <KeyboardAwareScreen
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
          </KeyboardAwareScreen>
        )}

        {/* Étape 2: Formulaire avec navigation par blocs */}
        {activeStep === 2 && (
          <View style={{ flex: 1 }}>
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

                  {/* Navigation entre blocs (tabs simples sans scroll horizontal) */}
                  {/* ✅ CORRIGÉ 2026-01-12: Utiliser currentDisplayIndex pour synchroniser avec le bloc affiché */}
                  {/* ✅ REFONTE: Navigation synchronisée avec currentDisplayIndex */}
                  {/* ✅ CORRECTION CRITIQUE: Utiliser une clé unique basée sur currentDisplayIndex pour forcer le re-render */}
                  <View key={`navigation-block-${currentDisplayIndex}`} style={styles.blockNavigation}>
                    {displayedBlocks.map(({ block, index: originalIndex }, displayIndex) => {
                      // ✅ REFONTE: Utiliser currentDisplayIndex comme source de vérité unique
                      // ✅ CORRECTION CRITIQUE: Vérifier explicitement que displayIndex correspond à currentDisplayIndex
                      const isActive = displayIndex === currentDisplayIndex;
                      
                      return (
                        <TouchableOpacity
                          key={`tab-${block.id}-${displayIndex}`}
                          style={[
                            styles.blockTab,
                            isActive && styles.blockTabActive
                          ]}
                          onPress={() => {
                            console.log('[NAVIGATION_TABS] Clic sur onglet:', {
                              blockId: block.id,
                              originalIndex,
                              displayIndex,
                              currentDisplayIndexAvant: currentDisplayIndex,
                            });
                            // ✅ REFONTE: Utiliser goToBlock avec originalIndex (sera converti en displayIndex)
                            goToBlock(originalIndex);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.blockTabIcon}>{block.icon}</Text>
                          <Text style={[
                            styles.blockTabText,
                            isActive && styles.blockTabTextActive
                          ]}>
                            {block.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* ✅ CORRIGÉ 2025-12-23: Afficher UNIQUEMENT le bloc actif (currentBlock) */}
                <KeyboardAwareScreen
                  innerRef={mainScrollViewRef}
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.contentContainer}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* ✅ CORRIGÉ: Utiliser activeBlockData comme source unique de vérité pour garantir la synchronisation */}
                  {activeBlockData ? (() => {
                    const { block, blockIndex, validDisplayIndex } = activeBlockData;
                    
                    // ✅ Log pour debug
                    console.log('[FormulaireYukpoIntelligentScreen] 📋 Affichage bloc:', {
                      currentDisplayIndex: validDisplayIndex,
                      blockId: block.id,
                      blockTitle: block.title,
                      blockIcon: block.icon
                    });
                    
                    return (
                      <View
                        key={`block-${block.id}-${validDisplayIndex}`}
                        ref={(ref) => {
                          blockRefs.current[blockIndex] = ref;
                        }}
                        onLayout={(event) => {
                          const { y } = event.nativeEvent.layout;
                          blockPositions.current[blockIndex] = y;
                        }}
                        style={styles.blockContainer}
                      >
                        <View style={styles.sectionContainer}>
                          <LinearGradient
                            colors={['#3B82F6', '#1D4ED8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.sectionHeader}
                          >
                            {/* ✅ CORRIGÉ: Utiliser activeBlockData.block pour garantir la synchronisation avec currentBlockFields */}
                            <Text key={`header-title-${block.id}-${validDisplayIndex}`} style={styles.sectionHeaderText}>
                              {block.icon} {block.title}
                            </Text>
                          </LinearGradient>

                        <NativeCard style={styles.sectionContent}>
                          {/* ✅ CORRIGÉ: Utiliser currentBlockFields calculé avec useMemo au niveau du composant */}
                          {currentBlockFields.map((field) => (
                            <React.Fragment key={field.name}>
                              {renderField(field)}
                            </React.Fragment>
                          ))}
                        </NativeCard>

                        {!isReadonly && activeBlockData && activeBlockData.block.id === 'payment' && (
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
                    </View>
                    );
                  })() : null}

                  {/* Boutons de navigation en bas du scroll */}
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
                </KeyboardAwareScreen>
              </>
            )}
          </View>
        )}
      </View>

      {/* ✅ NOUVEAU: Modal de confirmation de création de produit/service */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          setSuccessModalData(null);
          // Rediriger après fermeture
          if (fromMesServices) {
            (navigation as any).navigate('MesServices');
          } else {
            (navigation as any).navigate('Home');
          }
        }}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successModalIcon}>
              <Text style={styles.successModalIconText}>✅</Text>
            </View>
            <Text style={styles.successModalTitle}>
              {successModalData?.isPrestation ? 'Service créé avec succès !' : 'Produit créé avec succès !'}
            </Text>
            <Text style={styles.successModalMessage}>
              {successModalData?.isPrestation 
                ? `Votre service a été créé avec succès.${successModalData?.cout ? `\nCoût: ${successModalData.cout} tokens` : ''}`
                : 'Votre produit a été ajouté à votre service avec succès.'}
            </Text>
            <NativeButton
              title="Ok"
              variant="primary"
              onPress={async () => {
                setShowSuccessModal(false);
                
                // ✅ NOUVEAU: Si c'est un produit (pas une prestation), afficher d'abord le modal de confirmation
                if (successModalData && !successModalData.isPrestation && successModalData.productIndex >= 0) {
                  // Afficher le modal de confirmation de livraison automatique
                  setShowDeliveryAutoPrompt(true);
                } else {
                  // Pour les prestations, rediriger directement
                  if (fromMesServices) {
                    (navigation as any).navigate('MesServices');
                  } else {
                    (navigation as any).navigate('Home');
                  }
                  setSuccessModalData(null);
                }
              }}
              style={styles.successModalButton}
            />
          </View>
        </View>
      </Modal>

      {/* Modal GPS moderne */}
      <ModernGPSModal
        visible={showGPSModal}
        onClose={() => {
          setShowGPSModal(false);
          setGpsModalForField(null);
        }}
        onSelect={async (coordinatesString) => {
          // Parser les coordonnées depuis le format string
          // Format: "lat,lng" pour un point ou "lat1,lng1|lat2,lng2|..." pour une zone
          const firstPoint = coordinatesString.split('|')[0].split(',');
          if (firstPoint.length === 2) {
            const lat = parseFloat(firstPoint[0]);
            const lng = parseFloat(firstPoint[1]);
            
            if (!isNaN(lat) && !isNaN(lng)) {
              setSelectedLocation({ lat, lng });

              // ✅ CORRIGÉ 2026-01-12: Si c'est pour lieu_produit, utiliser reverseGeocodeWithRetry avec retry
              if (gpsModalForField === 'lieu_produit' || gpsModalForField === 'lieu_commercial' || gpsModalForField === 'lieu_commercialisation') {
                try {
                  const { reverseGeocodeWithRetry } = await import('../utils/reverseGeocoding');
                  const geocodeResult = await reverseGeocodeWithRetry(lat, lng, {
                    fallbackAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
                  });
                  
                  if (geocodeResult) {
                    const fullAddress = geocodeResult.address;
                    const placeName = geocodeResult.name || geocodeResult.street || geocodeResult.district || geocodeResult.city || 'Lieu sélectionné';
                    
                    // Construire un LocationObject avec le nom complet
                    const locationObject: LocationObject = {
                      raw: fullAddress,
                      place_name: placeName, // Nom principal du lieu (établissement, rue, quartier)
                      components: {
                        quartier: geocodeResult.district || undefined,
                        ville: geocodeResult.city || undefined,
                        region: geocodeResult.region || undefined,
                        pays: geocodeResult.country || undefined,
                      },
                      coordinates: { lat, lng },
                    };
                    
                    // Sauvegarder dans le formulaire
                    handleFieldChange(gpsModalForField, {
                      type_donnee: 'location',
                      valeur: locationObject,
                      composants: locationObject.components,
                      filtrable: true,
                      origine_champs: 'formulaire'
                    });
                  } else {
                    // Fallback si pas de géocodage inverse
                    const locationObject: LocationObject = {
                      raw: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                      place_name: 'Lieu sélectionné',
                      components: {},
                      coordinates: { lat, lng },
                    };
                    handleFieldChange(gpsModalForField, {
                      type_donnee: 'location',
                      valeur: locationObject,
                      composants: {},
                      filtrable: true,
                      origine_champs: 'formulaire'
                    });
                  }
                } catch (error) {
                  console.error('[FormulaireYukpoIntelligentScreen] Erreur géocodage inverse:', error);
                  // Fallback en cas d'erreur
                  const locationObject: LocationObject = {
                    raw: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                    place_name: 'Lieu sélectionné',
                    components: {},
                    coordinates: { lat, lng },
                  };
                  handleFieldChange(gpsModalForField, {
                    type_donnee: 'location',
                    valeur: locationObject,
                    composants: {},
                    filtrable: true,
                    origine_champs: 'formulaire'
                  });
                }
              } else {
                // Pour gps_fixe (localisation du service), stocker juste les coordonnées
                setValeursFormulaire(prev => ({
                  ...prev,
                  gps_fixe: coordinatesString
                }));
              }
            }
          }

          setShowGPSModal(false);
          setGpsModalForField(null);
        }}
        currentLocation={selectedLocation}
        title={gpsModalForField === 'lieu_produit' || gpsModalForField === 'lieu_commercial' || gpsModalForField === 'lieu_commercialisation' 
          ? "Sélectionner le lieu de commercialisation" 
          : "Sélection de localisation GPS"}
        allowZoneSelection={gpsModalForField !== 'lieu_produit' && gpsModalForField !== 'lieu_commercial' && gpsModalForField !== 'lieu_commercialisation'}
      />

      {/* ✅ NOUVEAU: Modal de confirmation de livraison automatique */}
      {successModalData && !successModalData.isPrestation && successModalData.productIndex >= 0 && (
        <DeliveryAutoConfigPromptModal
          visible={showDeliveryAutoPrompt}
          productName={successModalData.productName}
          onYes={async () => {
            setShowDeliveryAutoPrompt(false);
            // ✅ Attendre un délai pour permettre la synchronisation du produit
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            setProductDeliveryConfigData({
              serviceId: successModalData.serviceId,
              productIndex: successModalData.productIndex,
              productName: successModalData.productName,
            });
            setShowProductDeliveryConfig(true);
            setSuccessModalData(null);
          }}
          onNo={() => {
            setShowDeliveryAutoPrompt(false);
            setSuccessModalData(null);
            // Rediriger vers Home ou MesServices
            if (fromMesServices) {
              (navigation as any).navigate('MesServices');
            } else {
              (navigation as any).navigate('Home');
            }
          }}
        />
      )}

      {/* ✅ NOUVEAU: Modal de configuration de livraison pour les produits */}
      {productDeliveryConfigData && (
        <ProductDeliveryConfigModal
          visible={showProductDeliveryConfig}
          onClose={() => {
            setShowProductDeliveryConfig(false);
            setProductDeliveryConfigData(null);
            // Après fermeture, rediriger vers Home ou MesServices
            setTimeout(() => {
              if (fromMesServices) {
                (navigation as any).navigate('MesServices');
              } else {
                (navigation as any).navigate('Home');
              }
            }, 300);
          }}
          serviceId={productDeliveryConfigData.serviceId}
          productIndex={productDeliveryConfigData.productIndex}
          productName={productDeliveryConfigData.productName}
        />
      )}

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
  blockContainer: {
    marginBottom: 24,
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
    minHeight: 100, // ✅ REFONTE: Hauteur minimale réduite pour permettre un affichage normal (3 lignes * 24px + padding)
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'top', // ✅ CORRECTION: Aligner le texte en haut pour multiline
    // ✅ CORRECTION CRITIQUE: Permettre la croissance automatique et les retours à la ligne
    flexWrap: 'wrap',
    overflow: 'visible', // Permettre l'affichage complet du texte
  },
  // ✅ SUPPRIMÉ: productDescriptionInput et productDescriptionText - description_produit utilise maintenant les mêmes styles que description
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
  // ✅ NOUVEAU: Styles pour la modal de confirmation de création de produit/service
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successModalIconText: {
    fontSize: 32,
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 16,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  successModalButton: {
    width: '100%',
    minWidth: 200,
  },
  // ✅ ANCIEN: Styles pour l'overlay de succès (désactivé, remplacé par modal)
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
  select: {
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
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  selectText: {
    fontSize: 16,
    color: modernColors.text,
    flex: 1,
  },
  selectPlaceholder: {
    color: modernColors.textSecondary,
  },
  selectPlaceholderText: {
    color: modernColors.textSecondary,
    fontStyle: 'italic',
  },
  // ✅ AMÉLIORÉ 2026-01-12: Styles pour rendre le champ lieu plus visible
  selectEmpty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: modernColors.border,
    backgroundColor: '#FAFAFA',
  },
  selectRequiredEmpty: {
    borderWidth: 2,
    borderColor: modernColors.error,
    backgroundColor: '#FEF2F2',
    borderStyle: 'solid',
  },
  selectRequiredText: {
    color: modernColors.error,
    fontWeight: '600',
  },
  fieldContainerRequired: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  locationLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 8,
  },
  labelRequired: {
    color: modernColors.error,
    fontWeight: '700',
  },
  requiredBadge: {
    backgroundColor: modernColors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  requiredBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: modernColors.error,
    lineHeight: 18,
  },
  alertBold: {
    fontWeight: '700',
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
