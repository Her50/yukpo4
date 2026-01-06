// src/components/intelligence/FormulaireYukpoIntelligent.tsx

import DynamicField from '@/components/intelligence/DynamicFields';
import { GlobalIAStatsContext, GlobalIAStatsPanel } from '@/components/intelligence/GlobalIAStats';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons';
import MapModal from '@/components/ui/MapModal';
import { useUser } from '@/hooks/useUser';
import { appelerMoteurIA, creerService, modifierService } from '@/lib/yukpoaclient';
import { ComposantFrontend, dispatchChampsFormulaireIA } from '@/utils/form_constraint_dispatcher';
import { showServiceCreationErrorToast } from '@/utils/toastUtils';
import axios from 'axios';
import { MapPin } from 'lucide-react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_ENDPOINTS, buildUrl } from '../config/api.config';

import PaymentMethodSelector from '@/components/PaymentMethodSelector';
import BrandingManager from '@/components/ui/BrandingManager';
import ProductManager from '@/components/ui/ProductManager';
import MediaUploadManager from '@/components/ui/MediaUploadManager';
import LocationSelector, { LocationObject } from '@/components/ui/LocationSelector';
import ProductDeliveryConfigModal from '@/components/delivery/ProductDeliveryConfigModal';
import { productsService } from '@/services/productsService';

export default function FormulaireDemandeOuService() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const suggestion = location.state?.suggestion || {};
  const { confidence, tokens_consumed } = suggestion;
  // ✅ NOUVEAU: Extraire le session_id pour les combinaisons préférées IA
  const sessionId = suggestion?.session_id || suggestion?.data?.session_id || undefined;
  const mediaData = location.state?.mediaData || {};
  const gpsData = location.state?.gpsData || {}; // ?? NOUVEAU : Récupérer les données GPS
  const type = location.state?.type || '';
  const mode = location.state?.mode || 'create'; // ✅ CORRIGÉ : Par défaut 'create', pas 'edit'
  const serviceId = location.state?.serviceId;

  const [activeStep, setActiveStep] = useState(1);
  const [composants, setComposants] = useState<ComposantFrontend[]>([]);
  const [chargement, setChargement] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<any>(null); // ✅ NOUVEAU: Mode de paiement
  const [promotion, setPromotion] = useState({
    active: false,
    type: 'reduction' as 'reduction' | 'offre' | 'bon_plan' | 'flash',
    valeur: '',
    description: '',
    date_fin: '',
    conditions: '',
  });
  const [mediaFiles, setMediaFiles] = useState({
    images: mediaData.base64_image || [],
    audios: mediaData.audio_base64 || [],
    videos: mediaData.video_base64 || [],
    documents: mediaData.doc_base64 || [],
    excel: mediaData.excel_base64 || [],
    logo: mediaData.logo || [],
    banner: mediaData.banner || []
  });
  const [profilBrut, setProfilBrut] = useState<any>(null);
  const [gps, setGps] = useState<string | undefined>(undefined);
  const [valeursFormulaire, setValeursFormulaire] = useState<Record<string, any>>({});
  const [userContactInfo, setUserContactInfo] = useState<any>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successData, setSuccessData] = useState<{ serviceId: string; cout: number } | null>(null);
  const [showProductDeliveryConfig, setShowProductDeliveryConfig] = useState(false);
  const [productDeliveryConfigData, setProductDeliveryConfigData] = useState<{ serviceId: number; productIndex: number; productName: string } | null>(null);
  const { setStats } = useContext(GlobalIAStatsContext);

  // Charger les données du service à modifier
  useEffect(() => {
    const loadServiceData = async () => {
      if (mode === 'edit' && serviceId) {
        try {
          const token = localStorage.getItem('token');
          // ✅ CORRIGÉ: Utilise buildUrl
          const response = await axios.get(buildUrl(API_ENDPOINTS.SERVICES.DETAIL(parseInt(serviceId))), {
            headers: { Authorization: `Bearer ${token}` }
          });

          const serviceData = response.data;
          console.log('Données du service à modifier:', serviceData);

          // Pré-remplir les champs avec les données existantes
          if (serviceData.data) {
            const existingValues: Record<string, any> = {};

            // Extraire les valeurs des champs existants
            Object.keys(serviceData.data).forEach(key => {
              const fieldData = serviceData.data[key];
              if (fieldData && fieldData.valeur) {
                existingValues[key] = fieldData.valeur;
              } else if (typeof fieldData === 'string') {
                existingValues[key] = fieldData;
              }
            });

            // ✅ S'assurer que les contacts sont bien chargés
            existingValues.whatsapp = serviceData.data?.whatsapp?.valeur || serviceData.whatsapp || existingValues.whatsapp || '';
            existingValues.telephone = serviceData.data?.telephone?.valeur || serviceData.telephone || existingValues.telephone || '';
            existingValues.email = serviceData.data?.email?.valeur || serviceData.email || existingValues.email || '';
            existingValues.website = serviceData.data?.website?.valeur || serviceData.website || serviceData.siteweb || existingValues.website || '';

            console.log('✅ Valeurs pré-remplies:', existingValues);
            console.log('✅ Contacts chargés:', {
              whatsapp: existingValues.whatsapp,
              telephone: existingValues.telephone,
              email: existingValues.email,
              website: existingValues.website
            });

            setValeursFormulaire(existingValues);
          }

          // Pré-remplir les médias si disponibles
          if (serviceData.base64_image) {
            setMediaFiles(prev => ({
              ...prev,
              images: Array.isArray(serviceData.base64_image) ? serviceData.base64_image : [serviceData.base64_image]
            }));
          }

          // ✅ NOUVEAU: Pré-remplir la promotion si disponible
          if (serviceData.data?.promotion) {
            const promoData = serviceData.data.promotion.valeur || serviceData.data.promotion;
            if (promoData && typeof promoData === 'object') {
              setPromotion({
                active: promoData.active || false,
                type: promoData.type || 'reduction',
                valeur: promoData.valeur || '',
                description: promoData.description || '',
                date_fin: promoData.date_fin || '',
                conditions: promoData.conditions || '',
              });
              console.log('[FormulaireYukpoIntelligent] ✅ Promotion chargée:', promoData);
            }
          }

          // ✅ PHASE 4: Charger les produits depuis l'API au lieu de service.data.produits
          if (serviceId) {
            try {
              const products = await productsService.getProductsByService(parseInt(serviceId));
              console.log('[FormulaireYukpoIntelligent] ✅ Produits chargés depuis API:', products.length);
              // Les produits sont maintenant disponibles depuis l'API
              // Les champs dynamiques utiliseront ces données si nécessaire
            } catch (error) {
              console.warn('[FormulaireYukpoIntelligent] Erreur récupération produits, fallback JSONB:', error);
              // Fallback vers service.data.produits si l'API échoue
            }
          }

        } catch (error) {
          console.error('Erreur lors du chargement du service:', error);
          toast.error('Erreur lors du chargement des données du service');
        }
      }
    };

    loadServiceData();
  }, [mode, serviceId]);

  const handleMediaChange = (newMediaFiles: any) => {
    setMediaFiles(newMediaFiles);
  };

  const loadLastServiceContactInfo = async () => {
    if (!user?.id) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/services/last', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.data && Object.keys(response.data).length > 0) {
        const contactData = {
          whatsapp: response.data.whatsapp?.valeur || response.data.whatsapp || '',
          telephone: response.data.telephone?.valeur || response.data.telephone || '',
          email: response.data.email?.valeur || response.data.email || '',
          website: response.data.website?.valeur || response.data.website ||
            response.data.siteweb?.valeur || response.data.siteweb ||
            response.data.site?.valeur || response.data.site ||
            response.data.url?.valeur || response.data.url || ''
        };

        const hasContactInfo = Object.values(contactData).some(value => value && value.trim() !== '');
        if (hasContactInfo) {
          setUserContactInfo(contactData);
        }
      }
    } catch (error) {
      console.warn('Impossible de charger les contacts précédents:', error);
    }
  };

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude},${pos.coords.longitude}`;
        setGps(coords);
      },
      () => {
        console.warn("Impossible de récupérer la position GPS");
      }
    );

    setStats({
      confidence: 0,
      tokensUsed: 0,
      tokensFactured: 0,
      isProcessing: false,
      inputLength: 0,
      tokensCostXaf: undefined,
    });

    loadLastServiceContactInfo();
  }, [user?.id]);

  const handleFieldChange = (nomChamp: string, valeur: any) => {
    setValeursFormulaire(prev => ({
      ...prev,
      [nomChamp]: valeur
    }));
  };

  // ?? NOUVEAU : Fonction de validation des champs obligatoires
  const validateRequiredFields = () => {
    const errors: string[] = [];

    // ✅ NOUVEAU : Vérifier qu'au moins 1 produit est ajouté
    if (products.length === 0) {
      errors.push('⚠️ Vous devez ajouter au moins 1 produit');
    }

    // Vérifier les champs obligatoires selon les composants générés
    composants.forEach(composant => {
      if (composant.obligatoire) {
        const valeur = valeursFormulaire[composant.nomChamp];

        // Vérifier si le champ est vide ou non défini
        if (!valeur || (typeof valeur === 'string' && valeur.trim() === '')) {
          const label = composant.labelFrancais || composant.nomChamp
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          errors.push(`${label} est obligatoire`);
        }
      }
    });

    return errors;
  };

  const handleValidationService = async () => {
    if (chargement) return;

    // ?? NOUVEAU : Validation des champs obligatoires avant soumission
    const validationErrors = validateRequiredFields();
    if (validationErrors.length > 0) {
      toast.error(
        `⚠️ Veuillez remplir les champs obligatoires :\n${validationErrors.join('\n')}`,
        { duration: 6000 }
      );
      return;
    }

    // 🚀 NOUVEAU FLUX : Appeler l'IA d'abord pour obtenir le coût réel

    try {
      setChargement(true);

      let result;
      let iaResponse: any = null; // Pour stocker la réponse de l'IA externe

      // ✅ SI MODE MODIFICATION : Pas d'appel IA, pas de coût
      if (mode === 'edit' && serviceId) {
        console.log('[FormulaireYukpoIntelligent] 📝 MODE MODIFICATION - Pas d\'appel IA');

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

        // Ajouter les produits (y compris les nouveaux)
        if (products.length > 0) {
          const cleanedProducts = products.map(product => {
            const cleaned: any = {};
            Object.keys(product).forEach(key => {
              if (product[key] !== undefined && product[key] !== null && product[key] !== '') {
                cleaned[key] = product[key];
              }
            });
            return cleaned;
          });
          finalServiceData.produits = cleanedProducts;
          console.log('[FormulaireYukpoIntelligent] 📦 Produits ajoutés/mis à jour:', cleanedProducts.length);
        }

        // Ajouter le GPS fixe si présent
        if (valeursFormulaire.gps_fixe) {
          finalServiceData.gps_fixe = {
            type_donnee: 'string',
            valeur: valeursFormulaire.gps_fixe,
            origine_champs: 'formulaire'
          };
        }

        // ✅ NOUVEAU: Ajouter le mode de paiement si présent
        if (paymentMethod) {
          finalServiceData.mode_paiement = {
            type_donnee: 'object',
            valeur: paymentMethod,
            origine_champs: 'formulaire'
          };
          console.log('[FormulaireYukpoIntelligent] ✅ Mode de paiement ajouté (modification):', paymentMethod);
        }

        // ✅ NOUVEAU: Ajouter la promotion si activée
        if (promotion.active) {
          finalServiceData.promotion = {
            type_donnee: 'object',
            valeur: {
              active: true,
              type: promotion.type,
              valeur: promotion.valeur,
              description: promotion.description,
              date_fin: promotion.date_fin || null,
              conditions: promotion.conditions || null,
            },
            origine_champs: 'formulaire'
          };
          console.log('[FormulaireYukpoIntelligent] ✅ Promotion ajoutée (modification):', promotion);
        }

        // Préparer le payload de modification
        const updatePayload = {
          user_id: parseInt(user?.id || '0', 10),
          data: finalServiceData
        };

        console.log('[FormulaireYukpoIntelligent] 📝 Mise à jour du service:', serviceId);

        // Appeler l'API de mise à jour
        result = await modifierService(serviceId, updatePayload, 0); // 0 tokens pour modification

        // ✅ Succès modification (pas de coût)
        toast.success('✅ Service modifié avec succès!\n\n✅ Modification gratuite - Aucun frais', {
          duration: 5000
        });

        // Dispatcher l'événement de mise à jour
        window.dispatchEvent(new CustomEvent('service_updated'));
        localStorage.setItem('force_refresh_services', Date.now().toString());

        // Rediriger
        setTimeout(() => {
          navigate('/mes-services');
        }, 1500);

        return; // ✅ Sortir ici pour éviter le flux de création
      }

      // ✅ MODE CRÉATION : Appel IA + Vérification solde + Coût
      console.log('[FormulaireYukpoIntelligent] 🆕 MODE CRÉATION - Appel IA requis');

      // 💰 ÉTAPE 1 : Appeler l'IA externe pour générer le JSON ET obtenir le coût réel

      // ✅ CORRECTION 413: Compresser les médias AVANT l'envoi
      console.log('[FormulaireYukpoIntelligent] 🔄 Compression des médias...');
      const { compressAllMedia } = await import('../utils/mediaCompression');
      const compressedMedia = await compressAllMedia(mediaFiles);

      console.log('[FormulaireYukpoIntelligent] ✅ Médias compressés:', {
        before: `${(compressedMedia.totalSizeBefore / (1024 * 1024)).toFixed(2)} MB`,
        after: `${(compressedMedia.totalSizeAfter / (1024 * 1024)).toFixed(2)} MB`,
        saved: `${((1 - compressedMedia.totalSizeAfter / compressedMedia.totalSizeBefore) * 100).toFixed(1)}%`
      });

      // ✅ NOUVEAU: Upload préalable vers CDN avec cloudUploadService
      console.log('[FormulaireYukpoIntelligent] 📤 Upload médias vers CDN...');
      const { cloudUploadService } = await import('../services/cloudUploadService');
      
      // Compteur pour suivre la progression globale
      let totalMedia = compressedMedia.images.length + compressedMedia.videos.length + 
                      (compressedMedia.audios?.length || 0) + 
                      (compressedMedia.logo?.length || 0) + 
                      (compressedMedia.banner?.length || 0);
      let uploadedCount = 0;

      const updateProgress = (type: string) => {
        uploadedCount++;
        const progress = Math.round((uploadedCount / totalMedia) * 100);
        console.log(`[FormulaireYukpoIntelligent] 📤 Upload ${type}: ${uploadedCount}/${totalMedia} (${progress}%)`);
        // Optionnel: Afficher une notification de progression
        if (uploadedCount % 5 === 0 || uploadedCount === totalMedia) {
          toast.loading(`Upload médias: ${uploadedCount}/${totalMedia} (${progress}%)`, { id: 'upload-progress' });
        }
      };

      // Upload images vers CDN avec progression
      const uploadedImages = await Promise.all(
        compressedMedia.images.map(async (image, index) => {
          try {
            const result = await cloudUploadService.uploadToCloud(
              image, 
              'image',
              undefined,
              (progress) => {
                console.log(`[FormulaireYukpoIntelligent] Image ${index + 1}: ${progress.percentage.toFixed(0)}%`);
              }
            );
            updateProgress('images');
            return result.success && result.url ? result.url : image; // Fallback base64
          } catch (error) {
            console.warn('[FormulaireYukpoIntelligent] Erreur upload image, fallback base64:', error);
            updateProgress('images');
            return image; // Fallback base64
          }
        })
      );

      // Upload vidéos vers CDN avec progression
      const uploadedVideos = await Promise.all(
        compressedMedia.videos.map(async (video, index) => {
          try {
            const result = await cloudUploadService.uploadToCloud(
              video, 
              'video',
              undefined,
              (progress) => {
                console.log(`[FormulaireYukpoIntelligent] Vidéo ${index + 1}: ${progress.percentage.toFixed(0)}%`);
              }
            );
            updateProgress('videos');
            return result.success && result.url ? result.url : video; // Fallback base64
          } catch (error) {
            console.warn('[FormulaireYukpoIntelligent] Erreur upload vidéo, fallback base64:', error);
            updateProgress('videos');
            return video; // Fallback base64
          }
        })
      );

      // Upload audios vers CDN avec progression
      const uploadedAudios = await Promise.all(
        (compressedMedia.audios || []).map(async (audio, index) => {
          try {
            const result = await cloudUploadService.uploadToCloud(
              audio, 
              'audio',
              undefined,
              (progress) => {
                console.log(`[FormulaireYukpoIntelligent] Audio ${index + 1}: ${progress.percentage.toFixed(0)}%`);
              }
            );
            updateProgress('audios');
            return result.success && result.url ? result.url : audio; // Fallback base64
          } catch (error) {
            console.warn('[FormulaireYukpoIntelligent] Erreur upload audio, fallback base64:', error);
            updateProgress('audios');
            return audio; // Fallback base64
          }
        })
      );

      // Upload logo et banner vers CDN avec progression
      const uploadedLogo = await Promise.all(
        (compressedMedia.logo || []).map(async (logo, index) => {
          try {
            const result = await cloudUploadService.uploadToCloud(
              logo, 
              'logo',
              undefined,
              (progress) => {
                console.log(`[FormulaireYukpoIntelligent] Logo ${index + 1}: ${progress.percentage.toFixed(0)}%`);
              }
            );
            updateProgress('logo');
            return result.success && result.url ? result.url : logo; // Fallback base64
          } catch (error) {
            console.warn('[FormulaireYukpoIntelligent] Erreur upload logo, fallback base64:', error);
            updateProgress('logo');
            return logo; // Fallback base64
          }
        })
      );

      const uploadedBanner = await Promise.all(
        (compressedMedia.banner || []).map(async (banner, index) => {
          try {
            const result = await cloudUploadService.uploadToCloud(
              banner, 
              'banner',
              undefined,
              (progress) => {
                console.log(`[FormulaireYukpoIntelligent] Banner ${index + 1}: ${progress.percentage.toFixed(0)}%`);
              }
            );
            updateProgress('banner');
            return result.success && result.url ? result.url : banner; // Fallback base64
          } catch (error) {
            console.warn('[FormulaireYukpoIntelligent] Erreur upload banner, fallback base64:', error);
            updateProgress('banner');
            return banner; // Fallback base64
          }
        })
      );

      // Fermer la notification de progression
      toast.dismiss('upload-progress');

      const cdnCount = uploadedImages.filter(url => url.startsWith('http')).length +
                      uploadedVideos.filter(url => url.startsWith('http')).length +
                      uploadedAudios.filter(url => url.startsWith('http')).length +
                      uploadedLogo.filter(url => url.startsWith('http')).length +
                      uploadedBanner.filter(url => url.startsWith('http')).length;

      console.log('[FormulaireYukpoIntelligent] ✅ Médias uploadés vers CDN:', {
        total: totalMedia,
        cdn: cdnCount,
        fallback: totalMedia - cdnCount,
        images: uploadedImages.filter(url => url.startsWith('http')).length,
        videos: uploadedVideos.filter(url => url.startsWith('http')).length,
        audios: uploadedAudios.filter(url => url.startsWith('http')).length,
        logo: uploadedLogo.filter(url => url.startsWith('http')).length,
        banner: uploadedBanner.filter(url => url.startsWith('http')).length,
      });

      if (cdnCount > 0) {
        toast.success(`${cdnCount} média(x) uploadé(s) vers CDN avec succès`);
      }

      // Construire les données brutes pour l'IA avec médias uploadés (URLs CDN ou base64 fallback)
      const donneesService = {
        texte: composants.map(c => `${c.nomChamp}: ${valeursFormulaire[c.nomChamp] || ''}`).join('\n'),
        intention: 'creation_service',
        base64_image: uploadedImages, // URLs CDN ou base64
        audio_base64: uploadedAudios.length > 0 ? uploadedAudios : undefined,
        video_base64: uploadedVideos.length > 0 ? uploadedVideos : undefined,
        doc_base64: compressedMedia.documents, // Documents restent en base64
        excel_base64: compressedMedia.excel, // Excel reste en base64
        logo: uploadedLogo.length > 0 ? uploadedLogo : undefined,
        banner: uploadedBanner.length > 0 ? uploadedBanner : undefined
      };

      console.log('[FormulaireYukpoIntelligent] Données brutes pour génération IA (COMPRESSÉES)');

      // Appeler l'IA pour générer le JSON structuré (comptabilise les tokens)
      iaResponse = await appelerMoteurIA({
        texte: donneesService.texte || '',
        base64_image: donneesService.base64_image || [],
        audio_base64: donneesService.audio_base64 || [],
        video_base64: donneesService.video_base64 || [],
        doc_base64: donneesService.doc_base64 || [],
        excel_base64: donneesService.excel_base64 || [],
        logo: donneesService.logo || [],
        banner: donneesService.banner || []
      });

      console.log('[FormulaireYukpoIntelligent] Réponse IA reçue:', iaResponse);

      // 💰 ÉTAPE 2 : Calculer le coût réel et vérifier le solde AVANT création
      const tokensIAExterne = iaResponse.data.tokens_consumed || iaResponse.data.tokens_used || iaResponse.data.tokens || 0;
      console.log('[FormulaireYukpoIntelligent] Tokens IA externes consommés:', tokensIAExterne);

      // Calculer le coût réel avec le multiplier x100 pour création de service
      const coutTokenOpenAIFCFA = 0.004;
      const coutReel = Math.round(tokensIAExterne * coutTokenOpenAIFCFA * 100); // x100 pour création de service
      console.log('💰 [FormulaireYukpoIntelligent] Coût RÉEL calculé:', coutReel, 'FCFA pour', tokensIAExterne, 'tokens');

      // Vérifier le solde actuel
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('❌ Vous devez être connecté pour créer un service');
          return;
        }

        const balanceResponse = await fetch('/api/users/balance', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!balanceResponse.ok) {
          toast.error('❌ Impossible de vérifier votre solde. Veuillez réessayer.');
          return;
        }

        const balanceData = await balanceResponse.json();
        const soldeActuel = balanceData.tokens_balance || 0;

        console.log('💰 [FormulaireYukpoIntelligent] Solde actuel:', soldeActuel);

        // Vérifier si le solde est suffisant avec le coût RÉEL
        if (soldeActuel < coutReel) {
          toast.error(
            `💸 Solde insuffisant !\n\nCoût réel : ${coutReel.toLocaleString()} FCFA\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\n\nVeuillez recharger votre compte avant de créer ce service.`,
            { duration: 10000 }
          );
          return;
        }

        // Afficher une confirmation avec le coût RÉEL
        const confirmation = window.confirm(
          `💰 Création de service\n\nCoût réel : ${coutReel.toLocaleString()} FCFA\nTokens consommés : ${tokensIAExterne.toLocaleString()}\nVotre solde : ${soldeActuel.toLocaleString()} FCFA\nSolde après création : ${(soldeActuel - coutReel).toLocaleString()} FCFA\n\nConfirmez-vous la création de ce service ?`
        );

        if (!confirmation) {
          return;
        }

      } catch (error) {
        console.error('❌ [FormulaireYukpoIntelligent] Erreur vérification solde:', error);
        toast.error('❌ Erreur lors de la vérification du solde. Veuillez réessayer.');
        return;
      }

      // 🔧 ÉTAPE 3 : Extraire le JSON structuré de la réponse IA
      const jsonStructure = iaResponse.data;
      console.log('[FormulaireYukpoIntelligent] JSON structuré généré:', jsonStructure);

      // 🔧 CORRECTION : Extraire les vraies données de service depuis service_data.data
      let serviceData = jsonStructure;
      if (jsonStructure.service_data && jsonStructure.service_data.data) {
        serviceData = jsonStructure.service_data.data;
        console.log('[FormulaireYukpoIntelligent] Données de service extraites depuis service_data.data:', serviceData);
      } else if (jsonStructure.data) {
        serviceData = jsonStructure.data;
        console.log('[FormulaireYukpoIntelligent] Données de service extraites depuis data:', serviceData);
      }

      // 🔧 ÉTAPE 4 : Ajouter les produits aux données de service
      if (products.length > 0) {
        // Nettoyer les produits : supprimer les champs undefined/null/vides
        const cleanedProducts = products.map(product => {
          const cleaned: any = {};
          Object.keys(product).forEach(key => {
            if (product[key] !== undefined && product[key] !== null && product[key] !== '') {
              cleaned[key] = product[key];
            }
          });
          return cleaned;
        });
        serviceData.produits = cleanedProducts;
        console.log('[FormulaireYukpoIntelligent] Produits ajoutés (nettoyés):', cleanedProducts);
      }

      // ✅ CORRECTION CRITIQUE : Ajouter le GPS fixe si présent (évite GPS Nigeria)
      if (valeursFormulaire.gps_fixe) {
        serviceData.gps_fixe = {
          valeur: valeursFormulaire.gps_fixe,
          type: 'text'
        };
        console.log('[FormulaireYukpoIntelligent] ✅ GPS FIXE ajouté:', valeursFormulaire.gps_fixe);
      } else if (gpsData.gps_fixe_coords) {
        // Fallback: utiliser les coords du GPS initial si disponibles
        try {
          const coords = JSON.parse(gpsData.gps_fixe_coords);
          if (Array.isArray(coords) && coords.length > 0) {
            const { lat, lng } = coords[0];
            serviceData.gps_fixe = {
              valeur: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              type: 'text'
            };
            console.log('[FormulaireYukpoIntelligent] ✅ GPS FIXE ajouté depuis gpsData:', serviceData.gps_fixe.valeur);
          }
        } catch (e) {
          console.warn('[FormulaireYukpoIntelligent] ⚠️ Erreur parsing gps_fixe_coords');
        }
      }

      if (!serviceData.gps_fixe) {
        console.warn('[FormulaireYukpoIntelligent] ⚠️ AUCUN GPS FIXE - Le service utilisera le GPS en temps réel!');
      }

      // ✅ NOUVEAU: Ajouter le mode de paiement si présent
      if (paymentMethod) {
        serviceData.mode_paiement = {
          type_donnee: 'object',
          valeur: paymentMethod,
          origine_champs: 'formulaire'
        };
        console.log('[FormulaireYukpoIntelligent] ✅ Mode de paiement ajouté:', paymentMethod);
      }

      // ✅ NOUVEAU: Ajouter la promotion si activée
      if (promotion.active) {
        serviceData.promotion = {
          type_donnee: 'object',
          valeur: {
            active: true,
            type: promotion.type,
            valeur: promotion.valeur,
            description: promotion.description,
            date_fin: promotion.date_fin || null,
            conditions: promotion.conditions || null,
          },
          origine_champs: 'formulaire'
        };
        console.log('[FormulaireYukpoIntelligent] ✅ Promotion ajoutée:', promotion);
      }

      // 🔧 ÉTAPE 5 : Créer le service (en mode création uniquement)
      console.log('[FormulaireYukpoIntelligent] Transmission tokens IA externe au backend:', tokensIAExterne);

      // MODE CRÉATION : Utiliser l'endpoint de création
      result = await creerService(serviceData, tokensIAExterne);
      console.log('[FormulaireYukpoIntelligent] Service créé avec succès:', result);

      // Dispatcher l'événement de création
      window.dispatchEvent(new CustomEvent('service_created'));
      console.log('[FormulaireYukpoIntelligent] Événement service_created dispatché');
      localStorage.setItem('force_refresh_services', Date.now().toString());

      // 💰 Utiliser le coût réel calculé précédemment (en mode création)
      const tokensConsommes = tokensIAExterne;
      const coutFactureXAF = coutReel;
      console.log('[FormulaireYukpoIntelligent] Coût réel pour le toast:', coutFactureXAF, 'FCFA');

      setStats({
        confidence: 95,
        tokensUsed: tokensConsommes,
        tokensFactured: tokensConsommes,
        isProcessing: false,
        inputLength: composants.map(c => valeursFormulaire[c.nomChamp] || '').join(' ').length || 0,
        tokensCostXaf: coutFactureXAF,
      });

      // Stocker les données de succès pour le toast
      const createdServiceId = result.data?.id || result.data?.service_id || 'nouveau';
      setSuccessData({
        serviceId: createdServiceId,
        cout: coutFactureXAF
      });
      setShowSuccessToast(true);

      // ✅ NOUVEAU: Si c'est un produit (pas une prestation), ouvrir la configuration de livraison
      const typeOffre = valeursFormulaire.type_offre || serviceData.type_offre?.valeur || 'produit';
      const isPrestation = typeOffre === 'prestation' || typeOffre === 'service';
      const hasProducts = products && products.length > 0;
      
      if (!isPrestation && hasProducts && createdServiceId && createdServiceId !== 'nouveau') {
        // C'est un produit, ouvrir le modal de configuration de livraison pour le premier produit
        const firstProductIndex = 0;
        const firstProduct = products[0];
        const productName = firstProduct?.name || firstProduct?.nom_produit || valeursFormulaire.nom_produit || 'Nouveau produit';
        
        console.log('[FormulaireYukpoIntelligent] 🚚 Ouverture automatique du modal de configuration de livraison:', {
          serviceId: createdServiceId,
          productIndex: firstProductIndex,
          productName: productName
        });
        
        // Attendre un court délai pour laisser le toast s'afficher
        setTimeout(() => {
          setShowProductDeliveryConfig(true);
          setProductDeliveryConfigData({
            serviceId: typeof createdServiceId === 'number' ? createdServiceId : parseInt(String(createdServiceId), 10),
            productIndex: firstProductIndex,
            productName: productName
          });
        }, 1500);
        return; // Ne pas rediriger vers MesServices si on ouvre la config livraison
      }

      // Redirection automatique après 5 secondes (pour les prestations ou si pas de produits)
      setTimeout(() => {
        navigate('/mes-services');
      }, 5000);

    } catch (error: any) {
      console.error('Erreur lors de la création du service:', error);

      setStats({
        confidence: 0,
        tokensUsed: 0,
        tokensFactured: 0,
        isProcessing: false,
        inputLength: 0,
        tokensCostXaf: 0,
      });

      showServiceCreationErrorToast(error.message || 'Erreur lors de la création du service');
    } finally {
      setChargement(false);
    }
  };

  // ?? NOUVEAU : useEffect unifié pour charger les composants ET appliquer les données de l'IA
  useEffect(() => {
    console.log('[FormulaireYukpoIntelligent] useEffect déclenché - suggestion:', suggestion);
    console.log('[FormulaireYukpoIntelligent] Type de suggestion:', typeof suggestion);
    console.log('[FormulaireYukpoIntelligent] Clés de suggestion:', suggestion ? Object.keys(suggestion) : 'null');
    console.log('[FormulaireYukpoIntelligent] suggestion.data:', suggestion?.data);

    // ?? ÉTAPE 1: Toujours générer les composants (par défaut ou depuis l'IA)
    let composantsAGenerer;
    let valeursAAppliquer: Record<string, any> = {};

    // ?? Vérification plus robuste des données de l'IA
    // ?? CORRECTION : Vérifier la structure correcte des données
    const hasValidIAData = suggestion &&
      typeof suggestion === 'object' &&
      Object.keys(suggestion).length > 0 &&
      // ?? Vérifier que suggestion.data contient des champs de service
      suggestion.data &&
      typeof suggestion.data === 'object' &&
      (suggestion.data.titre_service || suggestion.data.category || suggestion.data.description);

    console.log('[FormulaireYukpoIntelligent] hasValidIAData:', hasValidIAData);

    if (hasValidIAData) {
      // ?? Données de l'IA disponibles - les utiliser depuis suggestion.data
      console.log('[FormulaireYukpoIntelligent] Utilisation des données de l\'IA:', suggestion.data);

      // ?? LOGS DE DÉBOGAGE SUPPLÉMENTAIRES
      console.log('[FormulaireYukpoIntelligent] Appel de dispatchChampsFormulaireIA avec:', suggestion);
      const composantsGeneres = dispatchChampsFormulaireIA(suggestion);
      console.log('[FormulaireYukpoIntelligent] Résultat de dispatchChampsFormulaireIA:', composantsGeneres);
      console.log('[FormulaireYukpoIntelligent] Type de composantsGeneres:', typeof composantsGeneres);
      console.log('[FormulaireYukpoIntelligent] Longueur de composantsGeneres:', composantsGeneres?.length);

      composantsAGenerer = composantsGeneres;

      // ?? Extraire les valeurs de l'IA pour pré-remplir les champs
      composantsAGenerer?.forEach(composant => {
        const champData = suggestion.data[composant.nomChamp];
        console.log(`[FormulaireYukpoIntelligent] Données pour ${composant.nomChamp}:`, champData);

        if (champData) {
          // ?? Gérer les deux formats possibles
          if (typeof champData === 'object' && 'valeur' in champData) {
            valeursAAppliquer[composant.nomChamp] = champData.valeur;
            console.log(`[FormulaireYukpoIntelligent] Valeur extraite (format objet) pour ${composant.nomChamp}:`, champData.valeur);
          } else {
            valeursAAppliquer[composant.nomChamp] = champData;
            console.log(`[FormulaireYukpoIntelligent] Valeur extraite (format direct) pour ${composant.nomChamp}:`, champData);
          }
        }
      });

      // ?? NOUVEAU : Traiter les données GPS séparément
      if (gpsData.gps_fixe) {
        console.log('[FormulaireYukpoIntelligent] Données GPS reçues:', gpsData);

        // ?? Convertir le format GPS si nécessaire
        let gpsValue = gpsData.gps_fixe;
        if (typeof gpsValue === 'string' && gpsValue.startsWith('[')) {
          try {
            const gpsArray = JSON.parse(gpsValue);
            if (Array.isArray(gpsArray) && gpsArray.length > 0) {
              const firstPoint = gpsArray[0];
              if (firstPoint.lat && firstPoint.lng) {
                gpsValue = `${firstPoint.lat},${firstPoint.lng}`;
                console.log('[FormulaireYukpoIntelligent] GPS converti en format simple:', gpsValue);
              }
            }
          } catch (e) {
            console.warn('[FormulaireYukpoIntelligent] Erreur parsing GPS:', e);
          }
        }

        valeursAAppliquer.gps_fixe = gpsValue;
        console.log('[FormulaireYukpoIntelligent] GPS fixe appliqué:', gpsValue);
      }
    } else {
      // ?? Aucune suggestion valide - utiliser les composants par défaut
      console.log('[FormulaireYukpoIntelligent] Génération de composants par défaut...');

      const suggestionParDefaut = {
        intention: 'creation_service',
        data: {
          titre_service: { type_donnee: 'string', valeur: '', origine_champs: 'formulaire' },
          category: { type_donnee: 'string', valeur: '', origine_champs: 'formulaire' },
          description: { type_donnee: 'string', valeur: '', origine_champs: 'formulaire' },
          is_tarissable: { type_donnee: 'boolean', valeur: true, origine_champs: 'formulaire' },
          whatsapp: { type_donnee: 'string', valeur: '', origine_champs: 'formulaire' },
          telephone: { type_donnee: 'string', valeur: '', origine_champs: 'formulaire' },
          email: { type_donnee: 'string', valeur: '', origine_champs: 'formulaire' },
          website: { type_donnee: 'string', valeur: '', origine_champs: 'formulaire' }
        }
      };

      composantsAGenerer = dispatchChampsFormulaireIA(suggestionParDefaut);

      // ?? Initialiser avec des valeurs vides
      composantsAGenerer?.forEach(composant => {
        const champData = suggestionParDefaut.data[composant.nomChamp as keyof typeof suggestionParDefaut.data];
        if (champData) {
          valeursAAppliquer[composant.nomChamp] = champData.valeur;
        }
      });
    }

    // ?? ÉTAPE 2: Appliquer les composants et valeurs
    if (composantsAGenerer && composantsAGenerer.length > 0) {
      console.log('[FormulaireYukpoIntelligent] Composants générés:', composantsAGenerer);
      console.log('[FormulaireYukpoIntelligent] Valeurs à appliquer:', valeursAAppliquer);

      // ?? LOGS DE DÉBOGAGE SUPPLÉMENTAIRES
      console.log('[FormulaireYukpoIntelligent] Nombre de composants:', composantsAGenerer.length);
      console.log('[FormulaireYukpoIntelligent] Nombre de valeurs:', Object.keys(valeursAAppliquer).length);

      // ?? Vérifier que chaque composant a une valeur correspondante
      composantsAGenerer.forEach(composant => {
        const valeur = valeursAAppliquer[composant.nomChamp];
        console.log(`[FormulaireYukpoIntelligent] Composant ${composant.nomChamp}: valeur =`, valeur);
      });

      setComposants(composantsAGenerer);
      setValeursFormulaire(valeursAAppliquer);
    }
  }, [suggestion]); // ?? Se déclenche au chargement initial ET quand suggestion change

  const champsRegroupes = useMemo(() => {
    const groupes = {
      base: [] as ComposantFrontend[],
      contact: [] as ComposantFrontend[],
      gpsFixe: null as ComposantFrontend | null,
      listeProduits: null as ComposantFrontend | null,
      autres: [] as ComposantFrontend[]
    };

    composants.forEach(composant => {
      if (composant.nomChamp === 'gps_fixe') {
        groupes.gpsFixe = composant;
      } else if (composant.nomChamp === 'liste_produits') {
        groupes.listeProduits = composant;
      } else if (['whatsapp', 'telephone', 'email', 'website'].includes(composant.nomChamp)) {
        groupes.contact.push(composant);
      } else if (['titre_service', 'category', 'description', 'is_tarissable'].includes(composant.nomChamp)) {
        groupes.base.push(composant);
      } else {
        groupes.autres.push(composant);
      }
    });

    return groupes;
  }, [composants]);

  // ?? CORRECTION : Fonction pour obtenir les coordonnées GPS avec leur source
  const getCurrentGPSInfo = () => {
    // Priorité 1: Coordonnées sélectionnées dans le formulaire (priorité maximale pour permettre la modification)
    if (valeursFormulaire.gps_fixe) {
      return {
        coords: valeursFormulaire.gps_fixe,
        source: 'Modifiées dans le formulaire',
        isRealTime: false
      };
    }

    // Priorité 2: Coordonnées sélectionnées depuis la carte (ChatInputPanel)
    if (gpsData.gps_fixe_coords) {
      try {
        const coords = JSON.parse(gpsData.gps_fixe_coords);
        if (Array.isArray(coords) && coords.length > 0) {
          const { lat, lng } = coords[0];
          return {
            coords: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            source: 'Sélectionnées sur la carte',
            isRealTime: false
          };
        }
      } catch (e) {
        console.warn('[FormulaireYukpoIntelligent] Erreur parsing GPS sélectionné:', e);
      }
    }

    // Priorité 3: Coordonnées en temps réel du navigateur
    if (gps) {
      return {
        coords: gps,
        source: 'Position actuelle',
        isRealTime: true
      };
    }

    return null;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <GlobalIAStatsPanel />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-start">
          <button
            onClick={() => navigate('/')}
            className="text-orange-600 hover:text-orange-800 font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors"
          >
            ← 🏠 Retour à l'accueil
          </button>

          <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-200">
            ⚠️ <strong>Rappel :</strong> Les champs marqués d'un astérisque (*) sont obligatoires
          </div>
        </div>

        {composants.length > 0 ? (
          <div className="space-y-3">
            {champsRegroupes.base.length > 0 && (
              <div className="p-2 space-y-2">
                <h3 className="font-bold text-sm text-center text-white bg-blue-500 rounded py-1 mb-1 max-w-sm mx-auto">
                  📝 Informations générales
                </h3>

                <div className="space-y-2">
                  {champsRegroupes.base.map((champ: ComposantFrontend, index: number) => (
                    <DynamicField
                      key={`${champ.nomChamp}-${index}`}
                      champ={champ}
                      valeurExistante={valeursFormulaire[champ.nomChamp]}
                      onChange={handleFieldChange}
                      readonly={mode === 'readonly'}
                    />
                  ))}
                </div>
              </div>
            )}

            {champsRegroupes.listeProduits && (
              <div className="p-2 space-y-2">
                <h3 className="font-bold text-sm text-center text-white bg-green-500 rounded py-1 mb-1 max-w-sm mx-auto">
                  📦 Liste des produits
                </h3>
                <div>
                  <DynamicField
                    key={champsRegroupes.listeProduits.nomChamp}
                    champ={champsRegroupes.listeProduits}
                    valeurExistante={valeursFormulaire[champsRegroupes.listeProduits.nomChamp]}
                    onChange={handleFieldChange}
                    readonly={mode === 'readonly'}
                  />
                </div>
              </div>
            )}

            {champsRegroupes.contact.length > 0 && (
              <div className="p-2 space-y-2">
                <h3 className="font-bold text-sm text-center text-white bg-orange-500 rounded py-1 mb-1 max-w-sm mx-auto">
                  📞 Contact
                </h3>
                <div className="space-y-2">
                  {champsRegroupes.contact.map((champ: ComposantFrontend, index: number) => (
                    <DynamicField
                      key={`${champ.nomChamp}-${index}`}
                      champ={champ}
                      valeurExistante={valeursFormulaire[champ.nomChamp]}
                      onChange={handleFieldChange}
                      isInContactBlock={true}
                      readonly={mode === 'readonly'}
                    />
                  ))}
                </div>
              </div>
            )}

            {champsRegroupes.gpsFixe && (
              <div className="p-2 space-y-2">
                <h3 className="font-bold text-sm text-center text-white bg-purple-500 rounded py-1 mb-1 max-w-sm mx-auto">
                  🎯 Position GPS fixe
                </h3>
                <div>
                  <DynamicField
                    key={champsRegroupes.gpsFixe.nomChamp}
                    champ={champsRegroupes.gpsFixe}
                    valeurExistante={valeursFormulaire[champsRegroupes.gpsFixe.nomChamp]}
                    onChange={handleFieldChange}
                    readonly={mode === 'readonly'}
                  />
                </div>
              </div>
            )}



            {/* Blocs fixes - toujours affichés */}
            <div className="p-2 space-y-2">
              <h3 className="font-bold text-sm text-center text-white bg-blue-500 rounded py-1 mb-1 max-w-sm mx-auto">
                📍 Localisation du service
              </h3>

              <div className="space-y-2">
                {/* Zone d'intervention avec LocationSelector */}
                <div className="bg-gray-50 rounded p-2 max-w-sm mx-auto">
                  <LocationSelector
                    label="Zone d'intervention"
                    value={valeursFormulaire.zone_intervention || ''}
                    onSelect={(location: LocationObject) => {
                      handleFieldChange('zone_intervention', location.raw || location.place_name);
                    }}
                    placeholder="Rechercher une ville, quartier ou pays..."
                    scope="all"
                    enrichWithBackend={true}
                    readonly={mode === 'readonly'}
                    className="mb-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Indiquez où vous proposez vos services (ville, quartier, région)
                  </p>
                </div>

                {/* Adresse (optionnel) */}
                <div className="bg-gray-50 rounded p-2 max-w-sm mx-auto">
                  <LocationSelector
                    label="Adresse (optionnel)"
                    value={valeursFormulaire.adresse || ''}
                    onSelect={(location: LocationObject) => {
                      handleFieldChange('adresse', location.raw || location.place_name);
                    }}
                    placeholder="Rechercher une adresse précise..."
                    scope="point"
                    enrichWithBackend={true}
                    readonly={mode === 'readonly'}
                    className="mb-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Adresse précise de votre établissement (si applicable)
                  </p>
                </div>

                {/* Position GPS fixe */}
                <div className="bg-gray-50 rounded p-2 max-w-sm mx-auto">
                  <label className="text-xs font-bold text-gray-700 mb-1 block">
                    🎯 Position GPS fixe (optionnel)
                  </label>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => mode !== 'readonly' && setShowMapModal(true)}
                      disabled={mode === 'readonly'}
                      className={`w-full flex items-center justify-between text-xs h-8 px-2 border border-gray-300 rounded transition-colors ${mode === 'readonly'
                        ? 'bg-gray-50 cursor-not-allowed text-gray-600'
                        : 'bg-white hover:bg-gray-50 focus:ring-1 focus:ring-green-400 focus:border-green-400'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        {valeursFormulaire.gps_fixe ? 'Modifier la position' : 'Sélectionner une position'}
                      </span>
                      <span className="text-gray-400">▼</span>
                    </button>

                    {getCurrentGPSInfo() && (
                      <div className="mt-2 text-xs text-green-600">
                        ✅ Position GPS enregistrée: {getCurrentGPSInfo()?.coords}
                        <div className="text-xs text-gray-500 mt-1">
                          📍 {getCurrentGPSInfo()?.source}{getCurrentGPSInfo()?.isRealTime ? ' (temps réel)' : ''}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    💡 <strong>Conseil :</strong> Renseignez ce champ si votre service est basé dans un lieu fixe
                    (boutique, bureau, atelier). Cela aide les clients à vous localiser plus facilement.
                  </div>

                  {showMapModal && mode !== 'readonly' && (
                    <MapModal
                      onClose={() => setShowMapModal(false)}
                      onSelect={(coords) => {
                        handleFieldChange('gps_fixe', coords);
                        setShowMapModal(false);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Bloc Produits */}
            <div className="p-2 space-y-2">
              <h3 className="font-bold text-sm text-center text-white bg-purple-500 rounded py-1 mb-1 max-w-sm mx-auto">
                🛍️ Produits
              </h3>
              <div className="space-y-2">
                <div className="max-w-sm mx-auto">
                  <ProductManager
                    products={products}
                    onProductsChange={setProducts}
                    readonly={mode === 'readonly'}
                    serviceId={serviceId ? parseInt(serviceId) : undefined}
                    sessionId={sessionId}
                  />
                </div>
              </div>
            </div>

            {/* Bloc Médias du Service */}
            <div className="p-2 space-y-2">
              <h3 className="font-bold text-sm text-center text-white bg-gradient-to-r from-blue-500 to-cyan-500 rounded py-1 mb-1 max-w-sm mx-auto">
                📸 Médias du Service
              </h3>
              <div className="space-y-2">
                <div className="max-w-sm mx-auto">
                  <MediaUploadManager
                    images={mediaFiles.images || []}
                    videos={mediaFiles.videos || []}
                    onImagesChange={(images) => handleMediaChange({ ...mediaFiles, images })}
                    onVideosChange={(videos) => handleMediaChange({ ...mediaFiles, videos })}
                    readonly={mode === 'readonly'}
                    maxImages={10}
                    maxVideos={3}
                    uploadToCDN={true}
                    onUploadProgress={(type, completed, total) => {
                      console.log(`[FormulaireYukpoIntelligent] Upload ${type}: ${completed}/${total}`);
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    💡 Ajoutez des photos et vidéos pour illustrer votre service et inspirer confiance
                  </p>
                </div>
              </div>
            </div>

            {/* Bloc Identité Visuelle */}
            <div className="p-2 space-y-2">
              <h3 className="font-bold text-sm text-center text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded py-1 mb-1 max-w-sm mx-auto">
                🎨 Identité Visuelle
              </h3>
              <div className="space-y-2">
                <div className="max-w-sm mx-auto">
                  <BrandingManager
                    logo={mediaFiles.logo || []}
                    banner={mediaFiles.banner || []}
                    onLogoChange={(logo) => handleMediaChange({ ...mediaFiles, logo })}
                    onBannerChange={(banner) => handleMediaChange({ ...mediaFiles, banner })}
                    readonly={mode === 'readonly'}
                  />
                </div>
              </div>
            </div>

            {/* Bloc Promotion et Offres */}
            <div className="p-2 space-y-2">
              <h3 className="font-bold text-sm text-center text-white bg-gradient-to-r from-yellow-500 to-orange-500 rounded py-1 mb-1 max-w-sm mx-auto">
                🎉 Promotion et Offres
              </h3>
              <div className="space-y-2">
                <div className="bg-gray-50 rounded p-2 max-w-sm mx-auto">
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={promotion.active}
                      onChange={(e) => setPromotion(prev => ({ ...prev, active: e.target.checked }))}
                      disabled={mode === 'readonly'}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Activer une promotion pour ce service
                    </span>
                  </label>

                  {promotion.active && (
                    <div className="space-y-3 mt-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Type de promotion
                        </label>
                        <select
                          value={promotion.type}
                          onChange={(e) => setPromotion(prev => ({ ...prev, type: e.target.value as any }))}
                          disabled={mode === 'readonly'}
                          className="w-full text-xs h-8 px-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        >
                          <option value="reduction">Réduction</option>
                          <option value="offre">Offre spéciale</option>
                          <option value="bon_plan">Bon plan</option>
                          <option value="flash">Offre flash</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Valeur de la promotion
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 20%, -5000 FCFA, 1+1 gratuit"
                          value={promotion.valeur}
                          onChange={(e) => setPromotion(prev => ({ ...prev, valeur: e.target.value }))}
                          disabled={mode === 'readonly'}
                          className="w-full text-xs h-8 px-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          placeholder="Décrivez votre promotion..."
                          value={promotion.description}
                          onChange={(e) => setPromotion(prev => ({ ...prev, description: e.target.value }))}
                          disabled={mode === 'readonly'}
                          rows={3}
                          className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Date de fin (optionnel)
                        </label>
                        <input
                          type="date"
                          value={promotion.date_fin}
                          onChange={(e) => setPromotion(prev => ({ ...prev, date_fin: e.target.value }))}
                          disabled={mode === 'readonly'}
                          className="w-full text-xs h-8 px-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Conditions spéciales (optionnel)
                        </label>
                        <textarea
                          placeholder="Ex: Valable uniquement sur commande en ligne"
                          value={promotion.conditions}
                          onChange={(e) => setPromotion(prev => ({ ...prev, conditions: e.target.value }))}
                          disabled={mode === 'readonly'}
                          rows={2}
                          className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        />
                      </div>

                      <p className="text-xs text-gray-500 mt-2 bg-yellow-50 p-2 rounded">
                        💡 <strong>Conseil :</strong> Les promotions augmentent la visibilité de votre service dans les résultats de recherche
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bloc Mode de Paiement */}
            <div className="p-2 space-y-2">
              <h3 className="font-bold text-sm text-center text-white bg-green-500 rounded py-1 mb-1 max-w-sm mx-auto">
                💳 Mode de paiement
              </h3>
              <div className="space-y-2">
                <div className="max-w-sm mx-auto">
                  <PaymentMethodSelector
                    onPaymentChange={setPaymentMethod}
                    readonly={mode === 'readonly'}
                  />
                </div>
              </div>
            </div>


            {composants.length > 0 && (
              <div className="flex justify-center pt-6 pb-4">
                {mode === 'readonly' ? (
                  <Button
                    onClick={() => navigate('/dashboard/mes-services')}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 font-semibold"
                  >
                    🔙 Retour à mes services
                  </Button>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      onClick={handleValidationService}
                      disabled={chargement || products.length === 0}
                      className={`px-8 py-3 font-semibold shadow-lg ${products.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                        } disabled:bg-gray-400`}
                    >
                      {chargement ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {mode === 'edit' ? 'Modification en cours...' : 'Création en cours...'}
                        </>
                      ) : (
                        mode === 'edit' ? '✏️ Modifier ce service' : '🚀 Créer ce service'
                      )}
                    </Button>
                    {products.length === 0 && !chargement && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <span className="text-red-500">*</span>
                        Vous devez ajouter au moins 1 produit pour créer le service
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Aucun composant à afficher</p>
          </div>
        )}

        {/* Toast de succès */}
        {showSuccessToast && successData && (
          <div className="fixed top-4 right-4 bg-green-500 text-white p-6 rounded-lg shadow-xl z-50 max-w-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-400 rounded-full flex items-center justify-center">
                  <span className="text-green-800 text-xl">✅</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">
                  {mode === 'edit' ? '✏️ Service modifié avec succès !' : '🎉 Service créé avec succès !'}
                </h3>
                <p className="text-green-100 mb-3">
                  {mode === 'edit'
                    ? 'Votre service a été mis à jour avec les nouvelles informations.'
                    : 'Votre service a été créé et est maintenant disponible.'
                  }
                </p>
                <div className="bg-green-600 rounded p-3 mb-4">
                  {mode === 'edit' ? (
                    <p className="text-sm">
                      <strong>✅ Modification gratuite</strong> - Aucun frais pour la mise à jour
                    </p>
                  ) : (
                    <p className="text-sm">
                      <strong>Coût de création :</strong> {successData.cout} FCFA
                    </p>
                  )}
                  <p className="text-xs text-green-200 mt-1">
                    ID du service : {successData.serviceId}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowSuccessToast(false);
                      navigate('/');
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                  >
                    🏠 Retour à l'accueil
                  </button>
                  <button
                    onClick={() => {
                      setShowSuccessToast(false);
                      navigate('/dashboard/mes-services');
                    }}
                    className="flex-1 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                  >
                    📋 Mes Services
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowSuccessToast(false)}
                className="flex-shrink-0 text-green-200 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
} 