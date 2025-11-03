// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
// Code corrigé (remplace @ts-ignore)
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import BrandingManagerMobile from '../components/BrandingManagerMobile';
// ✅ NOUVEAU 2025-11-02: Gestionnaire upload images/vidéos dédié
import MediaUploadManager from '../components/MediaUploadManager';
// Code corrigé (remplace @ts-ignore)
import ModernGPSModal from '../components/ModernGPSModal';
// Code corrigé (remplace @ts-ignore)
import PaymentMethodSelector from '../components/PaymentMethodSelector';
// Code corrigé (remplace @ts-ignore)
import { NativeButton, NativeCard, NativeDivider, NativeInput } from '../components/NativeDesign';
// ✅ SUPPRIMÉ: ProductManagerMobile intégré directement dans le formulaire
import LinearAutocompleteEditor from '../components/LinearAutocompleteEditor';
import LocationSelector from '../components/LocationSelector';
import PriceVariantSelector from '../components/PriceVariantSelector';
// ✅ AJOUT: Composants pour modalités personnalisées et sélection multiple
import ProductFieldSelector from '../components/ProductFieldSelector';
import { getSuggestedProductCategories } from '../utils/suggestProductCategories';
// Code corrigé (remplace @ts-ignore)
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
// TODO: Fix TypeScript type issue
// Code corrigé (remplace @ts-ignore)
import { modernColors } from '../theme/modernTheme';
import { DynamicField, processIASuggestion } from '../utils/formDispatcher';

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
}

const FormulaireYukpoIntelligentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, logout } = useAuth();
  const blockScrollViewRef = React.useRef<any>(null);

  // État des données reçues
  const suggestion = (route.params as any)?.suggestion || {};
  const mediaData = (route.params as any)?.mediaData || {};
  const gpsData = (route.params as any)?.gpsData || {};
  const type = (route.params as any)?.type || '';
  const mode = (route.params as any)?.mode || 'create'; // ✅ Par défaut 'create' au lieu de 'edit'
  const serviceId = (route.params as any)?.serviceId;
  const fromMesServices = (route.params as any)?.fromMesServices || false;
  const fromMesProduits = (route.params as any)?.fromMesProduits || false; // ✅ NOUVEAU
  const readonlyParam = (route.params as any)?.readonly || false;
  const focusBlock = (route.params as any)?.focusBlock; // ✅ NOUVEAU: Bloc à ouvrir ('produits', etc.)
  const focusProductId = (route.params as any)?.focusProductId; // ✅ NOUVEAU: ID du produit à sélectionner
  const duplicateProduct = (route.params as any)?.duplicateProduct; // ✅ NOUVEAU: Produit à dupliquer
  const editProductData = (route.params as any)?.editProductData; // ✅ NOUVEAU: Données du produit à modifier

  // ✅ Déterminer si on est en mode lecture seule
  const isReadonly = mode === 'readonly' || mode === 'view' || readonlyParam;

  // ✅ NOUVEAU 2025-11-01: Déterminer si on ajoute un produit à un service existant
  const isAddingProduct = mode === 'add_product' && serviceId && duplicateProduct;

  // États locaux
  const [activeStep, setActiveStep] = useState(1);
  const [composants, setComposants] = useState<DynamicField[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ NOUVEAU: Protection contre double soumission
  const [valeursFormulaire, setValeursFormulaire] = useState<Record<string, any>>({});
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  // ✅ SUPPRIMÉ: Duplication produits - Les produits sont maintenant gérés via les champs dynamiques
  const [mediaFiles, setMediaFiles] = useState<MediaFiles>({
    images: mediaData.base64_image || [],
    audios: mediaData.audio_base64 || [],
    videos: mediaData.video_base64 || [],
    documents: mediaData.doc_base64 || [],
    excel: mediaData.excel_base64 || []
  });
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

  // Fonction de gestion du retour
  const handleGoBack = () => {
    // ✅ Si on est au premier bloc, retourner à l'écran précédent
    if (currentBlock === 0) {
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
      setCurrentBlock(currentBlock - 1);
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
        title: 'Produits',
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
      // Bloc Localisation
      else if (['gps_fixe', 'zone_intervention', 'localisation', 'pays', 'ville', 'quartier'].includes(fieldName)) {
        blocks[2].fields.push(field);
      }
      // Bloc Produits
      // ✅ CORRECTION: Ne plus dépendre de la présence d'un champ produits de l'IA
      // Le bloc produits sera toujours présent avec un champ par défaut (voir plus bas)
      // ✅ AJOUT: price_variant (variabilite_prix) va aussi dans le bloc produits
      // ✅ IMPORTANT: Les champs spécifiques au produit (nom_produit, categorie_produit, description_produit, prix_produit, devise_produit)
      //    vont dans le bloc Produits, PAS dans Informations générales (qui contient titre_service, category, description)
      // ✅ CORRECTION CRITIQUE: Détecter aussi les champs par leur typeDonnee (autocomplete, price_variant)
      else if (
        ['liste_produits', 'produits', 'listeproduit', 'variabilite_prix', 'price_variant', 'nom_produit', 'categorie_produit', 'description_produit', 'prix_produit', 'devise_produit'].includes(fieldName) ||
        field.typeDonnee === 'price_variant' ||
        field.typeDonnee === 'autocomplete'
      ) {
        blocks[3].fields.push(field);
        console.log(`[FormulaireYukpoIntelligentScreen] ✅ Champ ajouté au bloc produits: ${field.name} (typeDonnee: ${field.typeDonnee})`);
      }
      // Bloc Médias (✅ logo/banner retirés 2025-11-02)
      else if (['images', 'videos', 'audios', 'documents'].includes(fieldName)) {
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
          label: isPrestation ? 'Nom de la prestation' : 'Nom du produit',
          required: false,
          placeholder: isPrestation
            ? 'Ex: Cours de maths niveau terminal, Réparation écran téléphone...'
            : 'Ex: iPhone 14 Pro Max 256GB, Toyota RAV4 2018 4x4...',
          value: formValues.nom_produit || ''
        },
        {
          name: 'categorie_produit',
          type: 'text',
          typeDonnee: 'string',
          label: 'Catégorie du produit',
          required: false,
          placeholder: 'Ex: Smartphone, Véhicule 4x4, Chaussure de sport...',
          value: formValues.categorie_produit || ''
        },
        {
          name: 'description_produit',
          type: 'textarea',
          typeDonnee: 'string',
          label: 'Description du produit',
          required: false,
          placeholder: 'Décrivez les caractéristiques spécifiques du produit...',
          value: formValues.description_produit || ''
        },
        {
          name: 'produits',
          type: 'autocomplete',
          typeDonnee: 'autocomplete',
          label: isPrestation ? 'Caractéristiques prestation' : 'Caractéristiques produit',
          required: false,
          placeholder: 'Tapez pour voir les suggestions...',
          identifiantBase: 'produits',
          sousCaracteristiques: formValues.produits?.sous_caracteristiques || {
            // ✅ PHASE 2: Localisation produit (chargée dynamiquement via placesService)
            // Note: Vide ici, sera rempli par LinearAutocompleteEditor avec autocomplete intelligent
            localisation: [],
            ville: [],
            quartier: [],

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
          label: isPrestation ? 'Nom de la prestation' : 'Nom du produit',
          required: false,
          placeholder: isPrestation
            ? 'Ex: Cours de maths niveau terminal, Réparation écran téléphone...'
            : 'Ex: iPhone 14 Pro Max 256GB, Toyota RAV4 2018 4x4...',
          value: formValues.nom_produit || ''
        },
        {
          name: 'categorie_produit',
          type: 'text',
          typeDonnee: 'string',
          label: 'Catégorie du produit',
          required: false,
          placeholder: 'Ex: Smartphone, Véhicule 4x4, Chaussure de sport...',
          value: formValues.categorie_produit || ''
        },
        {
          name: 'description_produit',
          type: 'textarea',
          typeDonnee: 'string',
          label: 'Description du produit',
          required: false,
          placeholder: 'Décrivez les caractéristiques spécifiques du produit...',
          value: formValues.description_produit || ''
        },
        {
          name: 'produits',
          type: 'autocomplete',
          typeDonnee: 'autocomplete',
          label: isPrestation ? 'Caractéristiques prestation' : 'Caractéristiques produit',
          required: false,
          placeholder: 'Tapez pour voir les suggestions...',
          identifiantBase: 'produits',
          sousCaracteristiques: formValues.produits?.sous_caracteristiques || {
            // ✅ PHASE 2: Localisation produit (chargée dynamiquement via placesService)
            // Note: Vide ici, sera rempli par LinearAutocompleteEditor avec autocomplete intelligent
            localisation: [],
            ville: [],
            quartier: [],

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
          required: false,
          placeholder: isPrestation
            ? 'Ex: Cours de mathématiques, Réparation téléphone, Consultation médicale...'
            : 'Ex: iPhone 14 Pro Max, Toyota RAV4 2018, Nike Air Max...',
          value: formValues.nom_produit || ''
        } as DynamicField);
      }
      if (!hasCategorieProduit) {
        productsBlock.fields.splice(hasNomProduit ? 1 : 0, 0, {
          name: 'categorie_produit',
          type: 'text',
          typeDonnee: 'string',
          label: 'Catégorie du produit/prestation',
          required: false,
          placeholder: 'Ex: Smartphone, Cours particulier, Service de réparation...',
          value: formValues.categorie_produit || ''
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
          value: formValues.description_produit || ''
        } as DynamicField);
      }
      if (!hasPrixProduit) {
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
      if (!hasDeviseProduit) {
        productsBlock.fields.splice((hasNomProduit ? 1 : 0) + (hasCategorieProduit ? 1 : 0) + (hasDescriptionProduit ? 1 : 0) + (hasPrixProduit ? 1 : 0), 0, {
          name: 'devise_produit',
          type: 'text',
          typeDonnee: 'string',
          label: 'Devise',
          required: false,
          placeholder: 'XAF, EUR, USD...',
          value: formValues.devise_produit || 'XAF'
        } as DynamicField);
      }
    }

    // S'assurer que le bloc médias est toujours présent
    if (!blocksWithFixedOnes.find(b => b.id === 'media').fields.length) {
      blocksWithFixedOnes.find(b => b.id === 'media')!.fields.push({
        name: '_media_manager',
        type: 'custom',
        label: 'Gestion des médias',
        required: false
      } as any);
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
    const productsValue = valeursFormulaire['produits'];

    // Vérifier si produits existe et contient au moins un élément
    if (Array.isArray(productsValue)) {
      // Pour autocomplete: chaque élément est une string concaténée (ex: "nom,marque,categorie,prix,quantite")
      // On considère qu'un produit existe si la string n'est pas vide après trim
      return productsValue.length > 0 && productsValue.some(product =>
        typeof product === 'string' && product.trim().length > 0
      );
    }

    return false;
  };

  // Fonction de validation d'un bloc complet
  const validateCurrentBlock = (): { isValid: boolean; errors: string[]; fieldErrors: Record<string, string> } => {
    const currentBlockData = blocks[currentBlock];
    if (!currentBlockData) return { isValid: true, errors: [], fieldErrors: {} };

    const errors: string[] = [];
    const newFieldErrors: Record<string, string> = {};

    // ✅ NOUVEAU: Validation spéciale pour le bloc produits - doit contenir au moins un produit
    if (currentBlockData.id === 'products') {
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

    if (currentBlock < blocks.length - 1) {
      setCurrentBlock(currentBlock + 1);
    }
  };

  const goToPreviousBlock = () => {
    if (currentBlock > 0) {
      setCurrentBlock(currentBlock - 1);
    }
  };

  const goToBlock = (blockIndex: number) => {
    if (blockIndex >= 0 && blockIndex < blocks.length) {
      const targetBlock = blocks[blockIndex];
      const productsBlockIndex = blocks.findIndex(b => b.id === 'products');

      // ✅ CORRECTION: Empêcher de passer à un bloc après le bloc produits si le bloc produits n'a pas de produits
      if (productsBlockIndex !== -1 && currentBlock === productsBlockIndex && blockIndex > productsBlockIndex) {
        // On essaie de quitter le bloc produits vers un bloc suivant
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
    }
  };

  // ✅ NOUVEAU: Charger les données du service en mode édition
  useEffect(() => {
    const loadServiceData = async () => {
      if (mode === 'edit' && serviceId) {
        console.log('[FormulaireYukpoIntelligentScreen] 📝 Mode édition - Chargement du service:', serviceId);

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
    console.log('[FormulaireYukpoIntelligentScreen] useEffect - Traitement des données IA au chargement');
    console.log('[FormulaireYukpoIntelligentScreen] Suggestion disponible:', !!suggestion);
    console.log('[FormulaireYukpoIntelligentScreen] Suggestion.data:', suggestion?.data);

    if (suggestion && suggestion.data) {
      console.log('[FormulaireYukpoIntelligentScreen] Données IA disponibles, génération automatique des composants');

      // Traiter les suggestions IA comme dans le frontend
      const components = processIASuggestion(suggestion);
      console.log('[FormulaireYukpoIntelligentScreen] Composants générés automatiquement:', components);

      // Extraire les valeurs des données IA pour pré-remplir les champs
      const initialValues: Record<string, any> = {};
      Object.keys(suggestion.data).forEach(fieldName => {
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

      setComposants(components);
      setValeursFormulaire(prev => ({
        ...prev, // Garder les contacts précédents
        ...initialValues // Les données IA écrasent les contacts si présentes
      }));
      setActiveStep(2); // Passer directement à l'étape 2 avec les données IA
      setCurrentBlock(0);
    } else {
      console.log('[FormulaireYukpoIntelligentScreen] Aucune donnée IA, rester à l\'étape 1');
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
  //   if (blockScrollViewRef.current && blocks.length > 0) {
  //     // Calculer la position du bloc (largeur de l'onglet + gap)
  //     // Chaque onglet fait environ 120px (minWidth) + 8px (gap) = 128px
  //     const blockWidth = 128;
  //     const scrollPosition = currentBlock * blockWidth;

  //     // Scroll avec un petit offset pour centrer mieux le bloc actif
  //     blockScrollViewRef.current.scrollTo({
  //       x: Math.max(0, scrollPosition - 20), // Petit offset pour meilleure visibilité
  //       animated: true
  //     });
  //   }
  // }, [currentBlock, blocks]);

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
      
      // Mettre à jour les states
      setValeursFormulaire(initialValues);
      setComposants(components);
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

    setValeursFormulaire(prev => ({
      ...prev,
      [fieldName]: processedValue
    }));
  };

  // Gérer les changements de médias
  const handleMediaChange = (newMediaFiles: MediaFiles) => {
    setMediaFiles(newMediaFiles);
  };

  // ✅ PHASE 3: Générer exemple dynamique pour autocomplete
  const generateDynamicExample = (field: DynamicField, currentValues: string[]): string => {
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

  // Rendu d'un champ (aligné sur le frontend avec tous les types)
  const renderField = (field: DynamicField) => {
    // ✅ NOUVEAU: Support pour les nouveaux types de données
    if (field.typeDonnee === 'autocomplete') {
      const currentValues = Array.isArray(valeursFormulaire[field.name]) ? valeursFormulaire[field.name] : [];
      const nbModalites = currentValues.length;
      const nbCaracteristiques = Object.keys(field.sousCaracteristiques || {}).length;

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

          {/* ✅ PHASE 3: Exemple dynamique */}
          <View style={styles.exampleBox}>
            <SafeIcon name="lightbulb" size={14} color={modernColors.primary} />
            <View style={styles.exampleContent}>
              <Text style={styles.exampleLabel}>Exemple :</Text>
              <Text style={styles.exampleValue} numberOfLines={1}>
                {generateDynamicExample(field, currentValues)}
              </Text>
            </View>
          </View>

          <LinearAutocompleteEditor
            label={field.label}
            identifiantBase={field.identifiantBase || field.name}
            sousCaracteristiques={field.sousCaracteristiques || {}}
            separateur={field.separateur || ','}
            value={currentValues}
            onChange={(values) => handleFieldChange(field.name, values)}
            required={field.required}
            placeholder={field.placeholder}
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
      return (
        <View key={field.name} style={styles.fieldContainer}>
          <PriceVariantSelector
            label={field.label}
            variable={field.variable || 'variante'}
            modalites={valeursFormulaire[field.name]?.modalites || field.modalites || []}
            onChange={(modalites) => {
              handleFieldChange(field.name, {
                type_donnee: 'price_variant',
                variable: field.variable || 'variante',
                modalites,
                filtrable: field.filtrable !== false,
                origine_champs: 'formulaire'
              });
            }}
            required={field.required}
            availableCurrencies={['XAF', 'EUR', 'USD']}
            defaultCurrency={valeursFormulaire.devise_produit || valeursFormulaire.devise || 'XAF'}
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
            placeholder={field.placeholder || 'Rechercher une ville ou un lieu...'}
            scope="city" // Peut être 'city' ou 'point' selon le contexte
            required={field.required}
          />
          {field.composants && Object.keys(field.composants).length > 0 && (
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

    // ✅ SUPPRIMÉ 2025-11-02: Bloc logo/bannière retiré selon demande utilisateur
    if (field.name === '_media_manager') {
      return null; // Ne plus afficher ce bloc
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
            onImagesChange={(images) => handleMediaChange({ ...mediaFiles, images })}
            onVideosChange={(videos) => handleMediaChange({ ...mediaFiles, videos })}
            readonly={isReadonly}
            maxImages={10}
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
              style={[styles.fieldInput, hasError && styles.fieldInputError]}
            />
            {hasError && (
              <Text style={styles.fieldErrorText}>⚠️ {String(hasError)}</Text>
            )}
          </View>
        );
      case 'textarea':
        const isProductDescField = field.name === 'description_produit';
        return (
          <View key={field.name} style={isProductDescField ? styles.productFieldContainer : styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <NativeInput
              placeholder={field.placeholder}
              value={valeursFormulaire[field.name] || ''}
              onChangeText={(text) => handleFieldChange(field.name, text)}
              multiline
              style={[styles.fieldInput, styles.textareaInput]}
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
      console.log('[FormulaireYukpoIntelligentScreen] Soumission du formulaire...', { mode, serviceId });

      // ✅ SI MODE MODIFICATION : Pas d'appel IA, pas de coût
      if (mode === 'edit' && serviceId) {
        console.log('[FormulaireYukpoIntelligentScreen] 📝 MODE MODIFICATION - Pas d\'appel IA');

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
        Alert.alert(
          '✅ Service modifié',
          'Votre service a été mis à jour avec succès.\n\n✅ Modification gratuite - Aucun frais',
          [
            {
              text: 'OK',
              onPress: () => {
                setSuccessData({ serviceId, cout: 0 });
                setShowSuccessToast(true);
                if (fromMesServices) {
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
      const { compressAllMedia } = await import('../utils/mediaCompression');
      const compressedMedia = await compressAllMedia(mediaFiles);

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

                  // Construire l'objet produit
                  const produitObj = {
                    nom: nomProduit,
                    prix: prixProduit,
                    categorie: categorieProduit,
                    description: descriptionProduit,
                    devise: deviseProduit
                  };

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

                // ✅ Marquer la soumission comme terminée
                setIsSubmitting(false);
                setLoading(false);

                // Redirection après 3 secondes
                setTimeout(() => {
                  if (fromMesServices) {
                    (navigation as any).navigate('MesServices');
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
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isReadonly ? 'Consultation' :
              mode === 'edit' ? 'Modification' :
                'Formulaire Intelligent'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isReadonly ? 'Mode lecture seule' :
              mode === 'edit' ? 'Modification en cours' :
                'Propulsé par l\'IA Yukpo'}
          </Text>
        </View>
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
                          { width: `${((currentBlock + 1) / blocks.length) * 100}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {currentBlock + 1} / {blocks.length}
                    </Text>
                  </View>

                  {/* Navigation entre blocs (tabs horizontales scrollables) */}
                  <ScrollView
                    ref={blockScrollViewRef}
                    horizontal
                    scrollEnabled={true}
                    showsHorizontalScrollIndicator={true}
                    pagingEnabled={false}
                    decelerationRate="fast"
                    snapToInterval={128}
                    snapToAlignment="start"
                    contentContainerStyle={styles.blockNavigationContent}
                    style={styles.blockNavigationScrollView}
                    onScrollEndDrag={(event) => {
                      // Détecter le bloc visible après le scroll manuel
                      const scrollX = event.nativeEvent.contentOffset.x;
                      const blockWidth = 128; // Largeur approximative d'un bloc avec gap (120px minWidth + 8px gap)
                      const newBlockIndex = Math.round(scrollX / blockWidth);
                      if (newBlockIndex >= 0 && newBlockIndex < blocks.length && newBlockIndex !== currentBlock) {
                        setCurrentBlock(newBlockIndex);
                        // Optionnel : Scroll léger pour centrer le bloc sélectionné
                        blockScrollViewRef.current?.scrollTo({
                          x: newBlockIndex * blockWidth,
                          animated: true
                        });
                      }
                    }}
                    onMomentumScrollEnd={(event) => {
                      // Détecter le bloc visible après le scroll avec momentum
                      const scrollX = event.nativeEvent.contentOffset.x;
                      const blockWidth = 128;
                      const newBlockIndex = Math.round(scrollX / blockWidth);
                      if (newBlockIndex >= 0 && newBlockIndex < blocks.length && newBlockIndex !== currentBlock) {
                        setCurrentBlock(newBlockIndex);
                      }
                    }}
                    scrollEventThrottle={16}
                  >
                    <View style={styles.blockNavigation}>
                      {(blocks || []).map((block, index) => (
                        <TouchableOpacity
                          key={block.id}
                          style={[
                            styles.blockTab,
                            currentBlock === index && styles.blockTabActive
                          ]}
                          onPress={() => goToBlock(index)}
                        >
                          <Text style={styles.blockTabIcon}>{block.icon}</Text>
                          <Text style={[
                            styles.blockTabText,
                            currentBlock === index && styles.blockTabTextActive
                          ]}>
                            {block.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Contenu scrollable */}
                <ScrollView
                  style={styles.contentScrollView}
                  contentContainerStyle={styles.contentContainer}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  {/* Affichage du bloc actuel uniquement */}
                  {blocks[currentBlock] && (
                    <View style={styles.sectionContainer}>
                      <LinearGradient
                        colors={['#3B82F6', '#1D4ED8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.sectionHeader}
                      >
                        <Text style={styles.sectionHeaderText}>
                          {blocks[currentBlock].icon} {blocks[currentBlock].title}
                        </Text>
                      </LinearGradient>

                      <NativeCard style={styles.sectionContent}>
                        {(blocks[currentBlock]?.fields || [])
                          .filter(field => field.name !== 'devise') // ✅ Masquer le champ devise (intégré dans prix)
                          .map((field, index) => renderField(field))}
                      </NativeCard>
                    </View>
                  )}

                  {/* Boutons de navigation */}
                  <View style={styles.navigationButtons}>
                    <TouchableOpacity
                      style={[
                        styles.navButton,
                        styles.navButtonSecondary,
                        currentBlock === 0 && styles.navButtonDisabled
                      ]}
                      onPress={goToPreviousBlock}
                      disabled={currentBlock === 0}
                    >
                      <SafeIcon name="chevron-left" size={20} color="#6B7280" />
                      <Text style={styles.navButtonTextSecondary}>Précédent</Text>
                    </TouchableOpacity>

                    {currentBlock < blocks.length - 1 ? (
                      <TouchableOpacity
                        style={[styles.navButton, styles.navButtonPrimary]}
                        onPress={goToNextBlock}
                      >
                        <Text style={styles.navButtonTextPrimary}>Suivant</Text>
                        <SafeIcon name="chevron-right" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : !isReadonly ? (
                      <TouchableOpacity
                        style={[
                          styles.navButton,
                          styles.navButtonSuccess,
                          (loading || isSubmitting) && styles.navButtonDisabled // ✅ Désactiver visuellement pendant soumission
                        ]}
                        onPress={soumettreFormulaire}
                        disabled={loading || isSubmitting} // ✅ Désactiver pendant loading OU soumission
                      >
                        <Text style={styles.navButtonTextSuccess}>
                          {(loading || isSubmitting)
                            ? (mode === 'edit' ? 'Modification...' : 'Création...')
                            : (mode === 'edit' ? 'Modifier le service' : 'Créer le service')
                          }
                        </Text>
                        <SafeIcon name="check" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
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
  productFieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 10,
    letterSpacing: 0.2,
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
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
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
});

export default FormulaireYukpoIntelligentScreen;
