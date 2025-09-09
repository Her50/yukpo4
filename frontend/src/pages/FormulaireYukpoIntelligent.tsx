// src/components/intelligence/FormulaireYukpoIntelligent.tsx

import React, { useEffect, useState, useMemo, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons';
import { toast } from 'react-hot-toast';
import { dispatchChampsFormulaireIA, ComposantFrontend } from '@/utils/form_constraint_dispatcher';
import DynamicField from '@/components/intelligence/DynamicFields';
import { appelerMoteurIA, creerService } from '@/lib/yukpoaclient';
import { MultiModalInput } from '@/types/yukpoIaClient';
import { useUser } from '@/hooks/useUser';
import { GlobalIAStatsContext, GlobalIAStatsPanel } from '@/components/intelligence/GlobalIAStats';
import axios from 'axios';
import { showServiceCreationToast, showServiceCreationErrorToast } from '@/utils/toastUtils';
import MapModal from '@/components/ui/MapModal';
import { MapPin } from 'lucide-react';

import MediaManager from '@/components/ui/MediaManager';

export default function FormulaireDemandeOuService() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const suggestion = location.state?.suggestion || {};
  const { confidence, tokens_consumed } = suggestion;
  const mediaData = location.state?.mediaData || {};
  const gpsData = location.state?.gpsData || {}; // ?? NOUVEAU : Récupérer les données GPS
  const type = location.state?.type || '';
  const mode = location.state?.mode || 'edit';
  const serviceId = location.state?.serviceId;

  const [activeStep, setActiveStep] = useState(1);
  const [composants, setComposants] = useState<ComposantFrontend[]>([]);
  const [chargement, setChargement] = useState(false);
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
  const { setStats } = useContext(GlobalIAStatsContext);

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
      
      if (serviceId) {
        // ?? CORRECTION : Construire donneesService pour la mise à jour
        const donneesService = {
          texte: composants.map(c => `${c.nomChamp}: ${valeursFormulaire[c.nomChamp] || ''}`).join('\n'),
          intention: 'creation_service',
          base64_image: mediaFiles.images,
          audio_base64: mediaFiles.audios,
          video_base64: mediaFiles.videos,
          doc_base64: mediaFiles.documents,
          excel_base64: mediaFiles.excel,
          logo: mediaFiles.logo,
          banner: mediaFiles.banner
        };
        
        result = await axios.put(`/api/services/${serviceId}`, donneesService, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } else {
        // 💰 ÉTAPE 1 : Appeler l'IA externe pour générer le JSON ET obtenir le coût réel
        
        // Construire les données brutes pour l'IA
        const donneesService = {
          texte: composants.map(c => `${c.nomChamp}: ${valeursFormulaire[c.nomChamp] || ''}`).join('\n'),
          intention: 'creation_service',
          base64_image: mediaFiles.images,
          audio_base64: mediaFiles.audios,
          video_base64: mediaFiles.videos,
          doc_base64: mediaFiles.documents,
          excel_base64: mediaFiles.excel,
          logo: mediaFiles.logo,
          banner: mediaFiles.banner
        };
        
        console.log('[FormulaireYukpoIntelligent] Données brutes pour génération IA:', donneesService);
        
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
        
        // 🔧 ÉTAPE 4 : Appeler l'endpoint de création avec les données de service correctes
        console.log('[FormulaireYukpoIntelligent] Transmission tokens IA externe au backend:', tokensIAExterne);
        result = await creerService(serviceData, tokensIAExterne);
        console.log('[FormulaireYukpoIntelligent] Service créé avec succès:', result);
      }
      
      window.dispatchEvent(new CustomEvent('service_created'));
      localStorage.setItem('force_refresh_services', Date.now().toString());
      
      // 💰 CORRECTION : Utiliser le coût réel calculé précédemment
      let coutFactureXAF = 0;
      let tokensConsommes = 0;
      
      if (iaResponse) {
        // Cas où l'IA externe a été appelée - utiliser le coût réel calculé
        tokensConsommes = iaResponse.data.tokens_consumed || iaResponse.data.tokens_used || iaResponse.data.tokens || 0;
        const coutTokenOpenAIFCFA = 0.004;
        coutFactureXAF = Math.round(tokensConsommes * coutTokenOpenAIFCFA * 100); // x100 pour création de service
        console.log('[FormulaireYukpoIntelligent] Coût réel utilisé pour le toast:', coutFactureXAF, 'FCFA');
      } else {
        // Cas de modification de service - utiliser les tokens de result
        if (result.data && typeof result.data === 'object') {
          tokensConsommes = result.data.tokens_consumed || result.data.tokens_used || result.data.tokens || 0;
        }
        
        // Pour les modifications, récupérer le coût depuis les headers backend
        let costHeader: string | null = null;
        if (result.headers) {
          if (typeof result.headers.get === 'function') {
            costHeader = result.headers.get('x-tokens-cost-xaf');
          } else {
            const headers = result.headers as any;
            costHeader = headers['x-tokens-cost-xaf'] ? String(headers['x-tokens-cost-xaf']) : null;
          }
        }
        
        if (costHeader) {
          coutFactureXAF = parseInt(costHeader, 10) || 0;
        } else {
          // Fallback : calculer localement pour modification (x10)
          const coutTokenOpenAIFCFA = 0.004;
          coutFactureXAF = Math.round(tokensConsommes * coutTokenOpenAIFCFA * 10);
          console.log('[FormulaireYukpoIntelligent] Coût calculé localement (fallback):', coutFactureXAF);
        }
      }

      setStats({
        confidence: 95,
        tokensUsed: tokensConsommes,
        tokensFactured: tokensConsommes,
        isProcessing: false,
        inputLength: composants.map(c => valeursFormulaire[c.nomChamp] || '').join(' ').length || 0, // ?? CORRECTION : Calculer la longueur depuis les composants
        tokensCostXaf: coutFactureXAF,
      });

      // Stocker les données de succès pour le toast
      console.log('[FormulaireYukpoIntelligent] Coût final pour le toast:', coutFactureXAF, 'FCFA');
      setSuccessData({
        serviceId: result.data?.id || 'nouveau',
        cout: coutFactureXAF
      });
      setShowSuccessToast(true);
      
      // Redirection automatique après 5 secondes
      setTimeout(() => {
        navigate('/dashboard/mes-services');
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
                <div className="bg-gray-50 rounded p-2 max-w-sm mx-auto">
                  <label className="text-xs font-bold text-gray-700 mb-1 block">
                    🎯 Position GPS fixe (optionnel)
                  </label>
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => mode !== 'readonly' && setShowMapModal(true)}
                      disabled={mode === 'readonly'}
                      className={`w-full flex items-center justify-between text-xs h-8 px-2 border border-gray-300 rounded transition-colors ${
                        mode === 'readonly'
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

            {/* Bloc Médias du service */}
            <div className="p-2 space-y-2">
              <h3 className="font-bold text-sm text-center text-white bg-orange-500 rounded py-1 mb-1 max-w-sm mx-auto">
                📁 Médias du service
              </h3>
              <div className="space-y-2">
                <div className="max-w-sm mx-auto">
                  <MediaManager 
                    mediaFiles={mediaFiles}
                    onMediaChange={handleMediaChange}
                    readonly={mode === 'readonly'}
                  />
                </div>
              </div>
            </div>
            
            <div className="p-2 space-y-2">
              <h3 className="font-bold text-sm text-center text-white bg-red-500 rounded py-1 mb-1 max-w-sm mx-auto">
                🎉 Promotion et Offres
              </h3>
              
              <div className="space-y-2">
                <div className="max-w-sm mx-auto">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                    <input
                      type="checkbox"
                      checked={valeursFormulaire.promotion_active || false}
                      onChange={(e) => handleFieldChange('promotion_active', e.target.checked)}
                      disabled={mode === 'readonly'}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    Activer une promotion pour ce service
                  </label>
                  
                  {valeursFormulaire.promotion_active && (
                    <div className="space-y-3 mt-3">
                      <div>
                        <label className="text-xs font-bold text-gray-700 mb-1 block">
                          🏷️ Type de promotion
                        </label>
                        <select
                          value={valeursFormulaire.promotion_type || 'reduction'}
                          onChange={(e) => handleFieldChange('promotion_type', e.target.value)}
                          disabled={mode === 'readonly'}
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        >
                          <option value="reduction">Réduction</option>
                          <option value="offre">Offre spéciale</option>
                          <option value="bon_plan">Bon plan</option>
                          <option value="flash">Offre flash</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-gray-700 mb-1 block">
                          💰 Valeur de la promotion
                        </label>
                        <input
                          type="text"
                          placeholder="ex: 20%, 50€, Gratuit"
                          value={valeursFormulaire.promotion_valeur || ''}
                          onChange={(e) => handleFieldChange('promotion_valeur', e.target.value)}
                          disabled={mode === 'readonly'}
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-gray-700 mb-1 block">
                          📝 Description de la promotion
                        </label>
                        <textarea
                          placeholder="Décrivez votre offre promotionnelle..."
                          value={valeursFormulaire.promotion_description || ''}
                          onChange={(e) => handleFieldChange('promotion_description', e.target.value)}
                          disabled={mode === 'readonly'}
                          rows={2}
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-gray-700 mb-1 block">
                          📅 Date de fin de promotion
                        </label>
                        <input
                          type="date"
                          value={valeursFormulaire.promotion_date_fin || ''}
                          onChange={(e) => handleFieldChange('promotion_date_fin', e.target.value)}
                          disabled={mode === 'readonly'}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-gray-700 mb-1 block">
                          ⚠️ Conditions (optionnel)
                        </label>
                        <textarea
                          placeholder="Conditions spéciales, limitations..."
                          value={valeursFormulaire.promotion_conditions || ''}
                          onChange={(e) => handleFieldChange('promotion_conditions', e.target.value)}
                          disabled={mode === 'readonly'}
                          rows={2}
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    💡 <strong>Conseil :</strong> Les promotions attirent l'attention et peuvent augmenter vos chances d'être contacté. 
                    Pensez à des offres attractives comme des réductions, des services gratuits ou des bonus.
                  </div>
                </div>
              </div>
            </div>
            
            {composants.length > 0 && (
              <div className="flex justify-center pt-4">
                {mode === 'readonly' ? (
                  <Button 
                    onClick={() => navigate('/dashboard/mes-services')}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 font-semibold"
                  >
                    🔙 Retour à mes services
                  </Button>
                ) : (
                  <Button 
                    onClick={handleValidationService}
                    disabled={chargement}
                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-8 py-3 font-semibold shadow-lg"
                  >
                    {chargement ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Création en cours...
                      </>
                    ) : (
                      '🚀 Créer ce service'
                    )}
                  </Button>
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
                <h3 className="font-bold text-lg mb-2">🎉 Service créé avec succès !</h3>
                <p className="text-green-100 mb-3">
                  Votre service a été créé et est maintenant disponible.
                </p>
                <div className="bg-green-600 rounded p-3 mb-4">
                  <p className="text-sm">
                    <strong>Coût de création :</strong> {successData.cout} FCFA
                  </p>
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