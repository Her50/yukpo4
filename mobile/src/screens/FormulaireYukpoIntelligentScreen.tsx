// @ts-ignore
import { useNavigation, useRoute } from '@react-navigation/native';
// @ts-ignore
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
// @ts-ignore
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
import MediaManagerMobile from '../components/MediaManagerMobile';
// @ts-ignore
import ModernGPSModal from '../components/ModernGPSModal';
// @ts-ignore
import ProductManagerMobile from '../components/ProductManagerMobile';
// @ts-ignore
import { NativeButton, NativeCard, NativeDivider, NativeInput } from '../components/NativeDesign';
// @ts-ignore
import SafeIcon from '../components/SafeIcon';
// @ts-ignore
import { useAuth } from '../contexts/AuthContext';
// @ts-ignore
// @ts-ignore
// @ts-ignore
import { modernColors } from '../theme/modernTheme';
// @ts-ignore
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
  logo: any[];
  banner: any[];
}

const FormulaireYukpoIntelligentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  // État des données reçues
  const suggestion = (route.params as any)?.suggestion || {};
  const mediaData = (route.params as any)?.mediaData || {};
  const gpsData = (route.params as any)?.gpsData || {};
  const type = (route.params as any)?.type || '';
  const mode = (route.params as any)?.mode || 'create'; // ✅ Par défaut 'create' au lieu de 'edit'
  const serviceId = (route.params as any)?.serviceId;
  const fromMesServices = (route.params as any)?.fromMesServices || false;
  const readonlyParam = (route.params as any)?.readonly || false;

  // ✅ Déterminer si on est en mode lecture seule
  const isReadonly = mode === 'readonly' || mode === 'view' || readonlyParam;

  // États locaux
  const [activeStep, setActiveStep] = useState(1);
  const [composants, setComposants] = useState<DynamicField[]>([]);
  const [loading, setLoading] = useState(false);
  const [valeursFormulaire, setValeursFormulaire] = useState<Record<string, any>>({});
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFiles>({
    images: mediaData.base64_image || [],
    audios: mediaData.audio_base64 || [],
    videos: mediaData.video_base64 || [],
    documents: mediaData.doc_base64 || [],
    excel: mediaData.excel_base64 || [],
    logo: mediaData.logo || [],
    banner: mediaData.banner || []
  });
  const [gps, setGps] = useState<string | undefined>(undefined);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successData, setSuccessData] = useState<ServiceData | null>(null);
  const [products, setProducts] = useState<any[]>([]);

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
  };

  // Fonction pour organiser les champs en blocs (alignée sur le frontend)
  const organizeFieldsIntoBlocks = (fields: DynamicField[]) => {
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
        title: 'Médias',
        icon: '📁',
        fields: [] as DynamicField[]
      },
      {
        id: 'promotion',
        title: 'Promotion et Offres',
        icon: '🎉',
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
      else if (['liste_produits', 'produits'].includes(fieldName)) {
        blocks[3].fields.push(field);
      }
      // Bloc Médias
      else if (['images', 'videos', 'audios', 'documents', 'logo', 'banner', 'banniere'].includes(fieldName)) {
        blocks[4].fields.push(field);
      }
      // Bloc Promotion
      else if (fieldName.startsWith('promotion_')) {
        blocks[5].fields.push(field);
      }
      // Autres
      else {
        blocks[6].fields.push(field);
      }
    });

    // Ajouter les blocs fixes (produits, médias, promotion) même s'ils n'ont pas de champs dynamiques
    // Car ils utilisent des composants spécialisés
    const blocksWithFixedOnes = [...blocks];

    // S'assurer que le bloc produits est toujours présent
    if (!blocksWithFixedOnes.find(b => b.id === 'products').fields.length) {
      blocksWithFixedOnes.find(b => b.id === 'products')!.fields.push({
        name: '_products_manager',
        type: 'custom',
        label: 'Gestion des produits',
        required: false
      } as any);
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

    // S'assurer que le bloc promotion est toujours présent
    if (!blocksWithFixedOnes.find(b => b.id === 'promotion').fields.length) {
      blocksWithFixedOnes.find(b => b.id === 'promotion')!.fields.push({
        name: '_promotion_block',
        type: 'custom',
        label: 'Promotions',
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

  // Fonction de validation d'un bloc complet
  const validateCurrentBlock = (): { isValid: boolean; errors: string[]; fieldErrors: Record<string, string> } => {
    const currentBlockData = blocks[currentBlock];
    if (!currentBlockData) return { isValid: true, errors: [], fieldErrors: {} };

    const errors: string[] = [];
    const newFieldErrors: Record<string, string> = {};

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
      setCurrentBlock(blockIndex);
    }
  };

  // Charger les informations de contact du dernier service (comme le frontend)
  useEffect(() => {
    const loadLastServiceContactInfo = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch('https://yukpomnang.onrender.com/api/services/last', {
          headers: { 'Authorization': `Bearer ${user?.token || ''}` }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && Object.keys(data).length > 0) {
            const contactData = {
              whatsapp: data.whatsapp?.valeur || data.whatsapp || '',
              telephone: data.telephone?.valeur || data.telephone || '',
              email: data.email?.valeur || data.email || '',
              website: data.website?.valeur || data.website || data.siteweb?.valeur || data.siteweb || ''
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

    loadLastServiceContactInfo();
  }, [user?.id]);

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
        if (fieldData && typeof fieldData === 'object' && 'valeur' in fieldData) {
          initialValues[fieldName] = fieldData.valeur;
          console.log(`[FormulaireYukpoIntelligentScreen] Valeur pré-remplie automatiquement pour ${fieldName}:`, fieldData.valeur);
        } else if (typeof fieldData === 'string' || typeof fieldData === 'number' || typeof fieldData === 'boolean') {
          // Gérer les valeurs directes (pas dans un objet {valeur: ...})
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

  // Organiser les champs en blocs quand les composants changent
  useEffect(() => {
    if (composants.length > 0) {
      const organizedBlocks = organizeFieldsIntoBlocks(composants);
      setBlocks(organizedBlocks);
      console.log('[FormulaireYukpoIntelligentScreen] Blocs organisés:', organizedBlocks);
    }
  }, [composants]);

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
        const initialValues: Record<string, any> = {};
        Object.keys(suggestion.data).forEach(fieldName => {
          const fieldData = suggestion.data[fieldName];
          if (fieldData && typeof fieldData === 'object' && 'valeur' in fieldData) {
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

        setComposants(components);
        setValeursFormulaire(initialValues);
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
    setValeursFormulaire(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  // Gérer les changements de médias
  const handleMediaChange = (newMediaFiles: MediaFiles) => {
    setMediaFiles(newMediaFiles);
  };

  // Rendu d'un champ (aligné sur le frontend avec tous les types)
  const renderField = (field: DynamicField) => {
    // Composants custom spécialisés
    if (field.name === '_products_manager') {
      return (
        <View key={field.name}>
          <ProductManagerMobile
            products={products}
            onProductsChange={setProducts}
            readonly={isReadonly}
          />
        </View>
      );
    }

    if (field.name === '_media_manager') {
      return (
        <View key={field.name}>
          <MediaManagerMobile
            mediaFiles={mediaFiles}
            onMediaChange={handleMediaChange}
            readonly={isReadonly}
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

    if (field.name === '_promotion_block') {
      return (
        <View key={field.name} style={styles.promotionBlock}>
          {/* Checkbox pour activer/désactiver la promotion */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => handleFieldChange('promotion_active', !valeursFormulaire.promotion_active)}
            disabled={isReadonly}
          >
            <View style={[
              styles.checkbox,
              valeursFormulaire.promotion_active && styles.checkboxChecked
            ]}>
              {valeursFormulaire.promotion_active && (
                <SafeIcon name="check" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Activer une promotion pour ce service</Text>
          </TouchableOpacity>

          {/* Champs de promotion (affichés seulement si activé) */}
          {valeursFormulaire.promotion_active && (
            <View style={styles.promotionFields}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>🏷️ Type de promotion</Text>
                <View style={styles.pickerButtons}>
                  {['reduction', 'offre', 'bon_plan', 'flash'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pickerButton,
                        valeursFormulaire.promotion_type === type && styles.pickerButtonActive
                      ]}
                      onPress={() => handleFieldChange('promotion_type', type)}
                      disabled={isReadonly}
                    >
                      <Text style={[
                        styles.pickerButtonText,
                        valeursFormulaire.promotion_type === type && styles.pickerButtonTextActive
                      ]}>
                        {type === 'reduction' ? 'Réduction' :
                          type === 'offre' ? 'Offre spéciale' :
                            type === 'bon_plan' ? 'Bon plan' : 'Offre flash'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>💰 Valeur de la promotion</Text>
                <NativeInput
                  placeholder="ex: 20%, 50€, Gratuit"
                  value={valeursFormulaire.promotion_valeur || ''}
                  onChangeText={(text) => handleFieldChange('promotion_valeur', text)}
                  style={styles.fieldInput}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>📝 Description de la promotion</Text>
                <NativeInput
                  placeholder="Décrivez votre offre promotionnelle..."
                  value={valeursFormulaire.promotion_description || ''}
                  onChangeText={(text) => handleFieldChange('promotion_description', text)}
                  multiline
                  style={[styles.fieldInput, styles.textareaInput]}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>📅 Date de fin de promotion</Text>
                <NativeInput
                  placeholder="JJ/MM/AAAA"
                  value={valeursFormulaire.promotion_date_fin || ''}
                  onChangeText={(text) => handleFieldChange('promotion_date_fin', text)}
                  style={styles.fieldInput}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>⚠️ Conditions (optionnel)</Text>
                <NativeInput
                  placeholder="Conditions spéciales, limitations..."
                  value={valeursFormulaire.promotion_conditions || ''}
                  onChangeText={(text) => handleFieldChange('promotion_conditions', text)}
                  multiline
                  style={[styles.fieldInput, styles.textareaInput]}
                />
              </View>
            </View>
          )}

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              💡 <Text style={styles.hintBold}>Conseil :</Text> Les promotions attirent l'attention et peuvent augmenter vos chances d'être contacté.
            </Text>
          </View>
        </View>
      );
    }

    // Champs standards
    switch (field.type) {
      case 'select':
      case 'dropdown':
        // ✅ CORRECTION : Ne plus traiter category comme un select
        // Tous les champs select/dropdown autres que category sont ignorés pour l'instant
        // category est maintenant un simple champ texte (traité dans case 'text')
        return null;

      case 'text':
      case 'email':
      case 'url':
        const hasError = fieldErrors[field.name];

        return (
          <View key={field.name} style={styles.fieldContainer}>
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
              <Text style={styles.fieldErrorText}>⚠️ {hasError}</Text>
            )}
          </View>
        );
      case 'textarea':
        return (
          <View key={field.name} style={styles.fieldContainer}>
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
        return (
          <View key={field.name} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <NativeInput
              placeholder={field.placeholder}
              value={valeursFormulaire[field.name]?.toString() || ''}
              onChangeText={(text) => handleFieldChange(field.name, text)}
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
    if (loading) return;

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
      console.log('[FormulaireYukpoIntelligentScreen] Soumission du formulaire...');

      // 💰 ÉTAPE 1 : Appeler l'IA externe pour générer le JSON structuré ET obtenir le coût réel
      // Construire les données brutes pour l'IA (comme le frontend)
      const donneesService = {
        texte: composants.map(c => `${c.name}: ${valeursFormulaire[c.name] || ''}`).join('\n'),
        intention: 'creation_service',
        base64_image: mediaFiles.images,
        audio_base64: mediaFiles.audios,
        video_base64: mediaFiles.videos,
        doc_base64: mediaFiles.documents,
        excel_base64: mediaFiles.excel,
        logo: mediaFiles.logo,
        banner: mediaFiles.banner
      };

      console.log('[FormulaireYukpoIntelligentScreen] Données brutes pour génération IA:', donneesService);

      // Appeler l'IA pour générer le JSON structuré (comptabilise les tokens)
      // ✅ CORRECTION : Utiliser /api/ia/creation-service qui existe dans le backend
      const iaResponse = await fetch('https://yukpomnang.onrender.com/api/ia/creation-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token || ''}`
        },
        body: JSON.stringify(donneesService)
      });

      if (!iaResponse.ok) {
        const errorText = await iaResponse.text();
        console.error('[FormulaireYukpoIntelligentScreen] Erreur IA:', errorText);
        throw new Error(`Erreur IA: ${iaResponse.status}`);
      }

      const iaData = await iaResponse.json();
      console.log('[FormulaireYukpoIntelligentScreen] Réponse IA reçue:', iaData);

      // 💰 ÉTAPE 2 : Calculer le coût réel avec le multiplier x100 pour création de service
      const tokensIAExterne = iaData.tokens_consumed || iaData.tokens_used || iaData.tokens || 0;
      const coutTokenOpenAIFCFA = 0.004;
      const coutReel = Math.round(tokensIAExterne * coutTokenOpenAIFCFA * 100); // x100 pour création de service
      console.log('💰 [FormulaireYukpoIntelligentScreen] Coût RÉEL calculé:', coutReel, 'FCFA pour', tokensIAExterne, 'tokens');

      // Vérifier le solde actuel
      const balanceResponse = await fetch('https://yukpomnang.onrender.com/api/users/balance', {
        headers: { 'Authorization': `Bearer ${user?.token || ''}` }
      });

      if (!balanceResponse.ok) {
        throw new Error('Impossible de vérifier votre solde');
      }

      const balanceData = await balanceResponse.json();
      const soldeActuel = balanceData.tokens_balance || 0;
      console.log('💰 [FormulaireYukpoIntelligentScreen] Solde actuel:', soldeActuel);

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
        `Coût réel : ${coutReel.toLocaleString()} FCFA\nTokens consommés : ${tokensIAExterne.toLocaleString()}\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\nSolde après création : ${(soldeActuel - coutReel).toLocaleString()} FCFA\n\nConfirmez-vous la création de ce service ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer',
            onPress: async () => {
              try {
                console.log('[FormulaireYukpoIntelligentScreen] Création du service en cours...');

                // 🔧 ÉTAPE 3 : Extraire le JSON structuré de la réponse IA (comme le frontend)
                let finalServiceData = iaData;
                if (iaData.service_data && iaData.service_data.data) {
                  finalServiceData = iaData.service_data.data;
                  console.log('[FormulaireYukpoIntelligentScreen] Données extraites depuis service_data.data:', finalServiceData);
                } else if (iaData.data) {
                  finalServiceData = iaData.data;
                  console.log('[FormulaireYukpoIntelligentScreen] Données extraites depuis data:', finalServiceData);
                }

                // 🔧 ÉTAPE 4 : Ajouter les produits aux données de service
                if (products.length > 0) {
                  finalServiceData.produits = products;
                  console.log('[FormulaireYukpoIntelligentScreen] Produits ajoutés:', products);
                }

                // ✅ CORRECTION CRITIQUE : Ajouter le GPS fixe si présent (évite GPS Nigeria)
                if (valeursFormulaire.gps_fixe) {
                  finalServiceData.gps_fixe = {
                    valeur: valeursFormulaire.gps_fixe,
                    type: 'text'
                  };
                  console.log('[FormulaireYukpoIntelligentScreen] ✅ GPS FIXE ajouté:', valeursFormulaire.gps_fixe);
                } else {
                  console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ AUCUN GPS FIXE - Le service utilisera le GPS en temps réel!');
                }

                // 🔧 ÉTAPE 5 : Créer le service avec les données structurées par l'IA
                console.log('[FormulaireYukpoIntelligentScreen] Transmission tokens IA externe au backend:', tokensIAExterne);

                // ✅ CORRECTION : Utiliser /api/services/create comme dans le frontend
                const response = await fetch('https://yukpomnang.onrender.com/api/services/create', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user?.token || ''}`
                  },
                  body: JSON.stringify({
                    user_id: user?.id,
                    ...finalServiceData,
                    ...(tokensIAExterne && { tokens_ia_externe: tokensIAExterne }) // Transmettre les tokens IA externes
                  })
                });

                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('[FormulaireYukpoIntelligentScreen] Erreur API:', errorText);
                  throw new Error(`Erreur création service: ${response.status} - ${errorText}`);
                }

                const result = await response.json();
                console.log('[FormulaireYukpoIntelligentScreen] Service créé avec succès:', result);

                setSuccessData({ serviceId: result.id || 'nouveau', cout: coutReel });
                setShowSuccessToast(true);

                // Redirection après 3 secondes
                setTimeout(() => {
                  if (fromMesServices) {
                    (navigation as any).navigate('MesServices');
                  } else {
                    (navigation as any).navigate('Home');
                  }
                }, 3000);

              } catch (innerError: any) {
                console.error('[FormulaireYukpoIntelligentScreen] Erreur création:', innerError);
                Alert.alert(
                  'Erreur de création',
                  innerError.message || 'Impossible de créer le service. Vérifiez vos données et réessayez.'
                );
                setLoading(false);
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('[FormulaireYukpoIntelligentScreen] Erreur soumission:', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de créer le service');
    } finally {
      setLoading(false);
    }
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
        <View style={styles.headerRight}>
          {/* Badge supprimé - la numérotation par blocs est suffisante */}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Étape 1: Génération du formulaire */}
        {activeStep === 1 && (
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
                  {Object.entries(suggestion.data).map(([key, value], index) => {
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
        )}

        {/* Étape 2: Formulaire avec navigation par blocs */}
        {activeStep === 2 && (
          <View style={styles.stepContainer}>
            {/* Navigation par blocs */}
            {blocks.length > 0 && (
              <>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.blockNavigationScrollView}>
                  <View style={styles.blockNavigation}>
                    {blocks.map((block, index) => (
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
                      {blocks[currentBlock].fields.map((field, index) => renderField(field))}
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
                      style={[styles.navButton, styles.navButtonSuccess]}
                      onPress={soumettreFormulaire}
                      disabled={loading}
                    >
                      <Text style={styles.navButtonTextSuccess}>
                        {loading
                          ? (mode === 'edit' ? 'Modification...' : 'Création...')
                          : (mode === 'edit' ? 'Modifier le service' : 'Créer le service')
                        }
                      </Text>
                      <SafeIcon name="check" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>

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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
  contentContainer: {
    padding: 20,
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
    backgroundColor: modernColors.background,
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: modernColors.text,
  },
  fieldInputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  fieldErrorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  textareaInput: {
    minHeight: 80,
    textAlignVertical: 'top',
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
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  navButtonSecondary: {
    backgroundColor: modernColors.background,
    borderWidth: 1,
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
  },
  navButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.textSecondary,
  },
  navButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navButtonTextSuccess: {
    fontSize: 14,
    fontWeight: '600',
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
    gap: 8,
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
    fontWeight: '600',
    color: modernColors.text,
    flex: 1,
  },
  promotionFields: {
    gap: 12,
    marginTop: 8,
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
  // Style pour le ScrollView horizontal du blockNavigation
  blockNavigationScrollView: {
    marginBottom: 20,
  },
  // Styles pour le champ GPS personnalisé
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
});

export default FormulaireYukpoIntelligentScreen;