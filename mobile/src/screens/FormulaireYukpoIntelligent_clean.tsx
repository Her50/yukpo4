// src/components/intelligence/FormulaireYukpoIntelligent.tsx

import React, { useEffect, useState, useMemo, useContext } from 'react';
import { useLocation, useNavigation } from 'react-router-dom';
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
import GPSTestComponent from '../components/GPSTestComponent';
import MediaManager from '@/components/ui/MediaManager';

export default function FormulaireDemandeOuService() {
  const location = useLocation();
  const navigate = useNavigation();
  const { user, isLoading } = useUser();
  const suggestion = location.state?.suggestion || {};
  const { confidence, tokens_consumed } = suggestion;
  // ?? NOUVEAU : Récupérer les médias transmis depuis HomePage
  const mediaData = location.state?.mediaData || {};
  const type = location.state?.type || '';
  const mode = location.state?.mode || 'edit';
  const serviceId = location.state?.serviceId; // ID du service à modifier

  const [activeStep, setActiveStep] = useState(1);
  const [composants, setComposants] = useState<ComposantFrontend[]>([]);
  const [chargement, setChargement] = useState(false);
  // ?? NOUVEAU : état pour gérer les médias
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
  const { setStats } = useContext(GlobalIAStatsContext);

  // Fonction pour gérer les changements de médias
  const handleMediaChange = (newMediaFiles: any) => {
    setMediaFiles(newMediaFiles);
  };

  // Fonction pour charger les informations de contact du dernier service
  const loadLastServiceContactInfo = async () => {
    if (!user?.id) {
      console.log('[FormulaireYukpoIntelligent] Pas d\'utilisateur, skip chargement contacts');
      return;
    }
    
    try {
      console.log('[FormulaireYukpoIntelligent] Chargement des contacts du dernier service...');
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/services/last', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      console.log('[FormulaireYukpoIntelligent] Réponse API /api/services/last:', response.data);
      
      if (response.data && Object.keys(response.data).length > 0) {
        // Extraire directement les valeurs de contact avec plus de flexibilité
        const contactData = {
          whatsapp: response.data.whatsapp?.valeur || response.data.whatsapp || '',
          telephone: response.data.telephone?.valeur || response.data.telephone || '',
          email: response.data.email?.valeur || response.data.email || '',
          website: response.data.website?.valeur || response.data.website || 
                   response.data.siteweb?.valeur || response.data.siteweb || 
                   response.data.site?.valeur || response.data.site || 
                   response.data.url?.valeur || response.data.url || ''
        };
        
        // Vérifier si on a au moins une valeur de contact
        const hasContactInfo = Object.values(contactData).some(value => value && value.trim() !== '');
        
        if (hasContactInfo) {
          setUserContactInfo(contactData);
          console.log('[FormulaireYukpoIntelligent] ✅ Informations de contact extraites:', contactData);
        } else {
          console.log('[FormulaireYukpoIntelligent] ⚠️ Aucune information de contact trouvée dans la réponse');
          setUserContactInfo(null);
        }
      } else {
        console.log('[FormulaireYukpoIntelligent] ⚠️ Réponse vide de /api/services/last');
        setUserContactInfo(null);
      }
    } catch (error) {
      console.warn('[FormulaireYukpoIntelligent] ❌ Impossible de charger les contacts précédents:', error);
      setUserContactInfo(null);
    }
  };

  // Effet pour charger les informations de contact et le GPS
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude},${pos.coords.longitude}`;
        setGps(coords);
      },
      () => {
        console.warn("⚠️ Impossible de récupérer la position GPS");
      }
    );

    // Initialiser les statistiques
    setStats({
      confidence: 0,
      tokensUsed: 0,
      tokensFactured: 0,
      isProcessing: false,
      inputLength: 0,
      tokensCostXaf: undefined,
    });

    // Charger les informations de contact du dernier service
    loadLastServiceContactInfo();
  }, [user?.id, setStats]);

  // Fonction pour gérer les changements de champs
  const handleFieldChange = (nomChamp: string, valeur: any) => {
    setValeursFormulaire(prev => ({
      ...prev,
      [nomChamp]: valeur
    }));
  };

  // Fonction pour valider et créer le service
  const handleValidationService = async () => {
    if (chargement) return;
    
    try {
      setChargement(true);
      console.log('[FormulaireYukpoIntelligent] Début de la création du service...');
      
      // Construire les données du service
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

      let result;
      
      if (serviceId) {
        // Modification d'un service existant
        console.log('[FormulaireYukpoIntelligent] Modification du service:', serviceId);
        result = await axios.put(`/api/services/${serviceId}`, donneesService, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log('[FormulaireYukpoIntelligent] Service modifié avec succès:', result);
      } else {
        // Création d'un nouveau service - d'abord générer le JSON structuré via l'IA
        console.log('[FormulaireYukpoIntelligent] Données brutes pour génération IA:', donneesService);
        
        // Appeler l'IA pour générer le JSON structuré
        const iaResponse = await appelerMoteurIA({
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
        
        // Extraire le JSON structuré de la réponse IA
        const jsonStructure = iaResponse.data;
        console.log('[FormulaireYukpoIntelligent] JSON structuré généré:', jsonStructure);
        
        // Maintenant appeler l'endpoint de création avec le JSON structuré
        result = await creerService(jsonStructure);
        console.log('[FormulaireYukpoIntelligent] Service créé avec succès:', result);
      }
      
      // Déclencher l'événement service_created pour notifier MesServices
      console.log('[FormulaireYukpoIntelligent] Émission de l\'événement service_created...');
      window.dispatchEvent(new CustomEvent('service_created'));
      console.log('[FormulaireYukpoIntelligent] Événement service_created émis avec succès');
      
      // Forcer l'actualisation via localStorage pour s'assurer que MesServices se met à jour
      localStorage.setItem('force_refresh_services', Date.now().toString());
      console.log('[FormulaireYukpoIntelligent] Flag de rafraîchissement forcé ajouté au localStorage');
      
      // Récupérer le coût réel facturé par l'application depuis la réponse du backend
      console.log('[FormulaireYukpoIntelligent] Réponse complète du backend:', result);
      console.log('[FormulaireYukpoIntelligent] Headers de la réponse:', result.headers);
      console.log('[FormulaireYukpoIntelligent] Headers disponibles:', Object.keys(result.headers || {}));
      
      // Extraire les tokens depuis la réponse - vérifier plusieurs sources possibles
      let tokensConsommes = 0;
      if (result.data && typeof result.data === 'object') {
        tokensConsommes = result.data.tokens_consumed || 
                         result.data.tokens_used || 
                         result.data.tokens || 0;
        console.log('[FormulaireYukpoIntelligent] Tokens trouvés dans data:', tokensConsommes);
      }
      
      // Si pas de tokens dans data, vérifier les headers
      if (tokensConsommes === 0 && result.headers) {
        try {
          // Gérer à la fois les Headers natifs (fetch) et les AxiosHeaders (axios)
          let tokensHeader: string | null = null;
          if (typeof result.headers.get === 'function') {
            // Headers natifs (fetch)
            tokensHeader = result.headers.get('x-tokens-consumed');
          } else {
            // AxiosHeaders (axios) - utiliser any pour éviter les problèmes de type
            const headers = result.headers as any;
            const headerValue = headers['x-tokens-consumed'];
            tokensHeader = headerValue ? String(headerValue) : null;
          }
          
          if (tokensHeader) {
            tokensConsommes = parseInt(tokensHeader, 10) || 0;
            console.log('[FormulaireYukpoIntelligent] Tokens trouvés dans header:', tokensConsommes);
          }
        } catch (error) {
          console.warn('[FormulaireYukpoIntelligent] Erreur lors de la lecture du header tokens:', error);
        }
      }
      
      // Fallback : utiliser une valeur par défaut seulement si vraiment nécessaire
      if (tokensConsommes === 0) {
        console.warn('[FormulaireYukpoIntelligent] Aucun token trouvé dans la réponse, utilisation de la valeur par défaut');
        tokensConsommes = 2; // Valeur par défaut seulement si aucune donnée n'est disponible
      }
      
      const intention = donneesService.intention || 'creation_service';
      console.log('[FormulaireYukpoIntelligent] Tokens consommés:', tokensConsommes, 'Intention:', intention);
      
      // Récupérer le coût réel depuis les headers HTTP du backend
      let coutFactureXAF = 0;
      
      // Gérer à la fois les Headers natifs (fetch) et les AxiosHeaders (axios)
      let costHeader: string | null = null;
      if (typeof result.headers.get === 'function') {
        // Headers natifs (fetch)
        costHeader = result.headers.get('x-tokens-cost-xaf');
      } else {
        // AxiosHeaders (axios) - utiliser any pour éviter les problèmes de type
        const headers = result.headers as any;
        const headerValue = headers['x-tokens-cost-xaf'];
        costHeader = headerValue ? String(headerValue) : null;
      }
      
      if (costHeader) {
        coutFactureXAF = parseInt(costHeader, 10);
        console.log('[FormulaireYukpoIntelligent] Coût récupéré depuis header HTTP:', coutFactureXAF, 'XAF');
      } else {
        // Fallback : calculer le coût côté frontend (multiplication sur la valeur FCFA du token OpenAI)
        const coutTokenOpenAIFCFA = 0.004; // Coût réel d'un token OpenAI en FCFA
        const coutBaseFCFA = tokensConsommes * coutTokenOpenAIFCFA;
        
        if (intention === 'creation_service') {
          coutFactureXAF = Math.round(coutBaseFCFA * 100); // Multiplier par 100 pour création de service (correspond au backend)
        } else {
          coutFactureXAF = Math.round(coutBaseFCFA * 10); // Multiplier par 10 pour autres intentions
        }
        console.log('[FormulaireYukpoIntelligent] Coût calculé côté frontend (fallback):', coutFactureXAF, 'XAF');
      }

      // Mettre à jour les statistiques avec le coût de création du service
      setStats({
        confidence: 95, // Confiance élevée pour une création réussie
        tokensUsed: tokensConsommes, // Tokens OpenAI réels
        tokensFactured: tokensConsommes, // Même valeur pour la facturation
        isProcessing: false,
        inputLength: donneesService.texte?.length || 0,
        tokensCostXaf: coutFactureXAF,
      });

      // Afficher le toast de succès
      showServiceCreationToast(result.data?.id || 'nouveau');
      
      // Rediriger vers la page des services
      setTimeout(() => {
        navigation.navigate('/dashboard/mes-services');
      }, 2000);
      
    } catch (error: any) {
      console.error('[FormulaireYukpoIntelligent] Erreur lors de la création du service:', error);
      
      // Mettre à jour les statistiques en cas d'erreur
      setStats({
        confidence: 0,
        tokensUsed: 0,
        tokensFactured: 0,
        isProcessing: false,
        inputLength: 0,
        tokensCostXaf: 0,
      });
      
      // Afficher le toast d'erreur
      showServiceCreationErrorToast(error);
    } finally {
      setChargement(false);
    }
  };

  // Effet pour traiter les données pré-remplies
  useEffect(() => {
    if (suggestion && Object.keys(suggestion).length > 0) {
      console.log('[FormulaireYukpoIntelligent] Données pré-remplies reçues:', suggestion);
      console.log('[FormulaireYukpoIntelligent] Type de suggestion:', typeof suggestion);
      console.log('[FormulaireYukpoIntelligent] Clés de suggestion:', Object.keys(suggestion));
      
      if (suggestion.intention) {
        console.log('[FormulaireYukpoIntelligent] suggestion.intention:', suggestion.intention);
      }
      
      if (suggestion.data) {
        console.log('[FormulaireYukpoIntelligent] suggestion.data:', suggestion.data);
        console.log('[FormulaireYukpoIntelligent] Contenu de suggestion.data:', suggestion.data);
        console.log('[FormulaireYukpoIntelligent] Clés de suggestion.data:', Object.keys(suggestion.data));
        
        // Vérifier les informations de contact disponibles
        const hasContactInfo = suggestion.data.whatsapp || suggestion.data.telephone || suggestion.data.email || suggestion.data.website;
        console.log('[FormulaireYukpoIntelligent] Informations de contact disponibles:', hasContactInfo);
        
        // Appeler dispatchChampsFormulaireIA pour générer les composants
        console.log('[FormulaireYukpoIntelligent] Appel de dispatchChampsFormulaireIA...');
        const composantsGeneres = dispatchChampsFormulaireIA(suggestion);
        console.log('[FormulaireYukpoIntelligent] Résultat dispatchChampsFormulaireIA:', composantsGeneres);
        
        if (composantsGeneres && composantsGeneres.length > 0) {
          setComposants(composantsGeneres);
          console.log('[FormulaireYukpoIntelligent] Nombre de champs générés:', composantsGeneres.length);
          
          // Pré-remplir les valeurs
          const valeursPreRemplies: Record<string, any> = {};
          composantsGeneres.forEach(composant => {
            if (suggestion.data[composant.nomChamp]) {
              valeursPreRemplies[composant.nomChamp] = suggestion.data[composant.nomChamp].valeur || suggestion.data[composant.nomChamp];
            }
          });
          setValeursFormulaire(valeursPreRemplies);
        }
      }
    }
  }, [suggestion]);

  // Grouper les champs par catégorie
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

  if (isLoading) {
    return (
      <AppLayout>
        <View style="flex items-center justify-center min-h-screen">
          <View style="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></View>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Panneau de statistiques IA */}
      <GlobalIAStatsPanel />
      
      <View style="container mx-auto px-4 py-8">
        {/* En-tête avec navigation */}
        <View style="mb-8">
          <nav style="flex space-x-4 mb-4">
            <TouchableOpacity
              onClick={() => navigation.navigate('Home')}
              style="text-orange-600 hover:text-orange-800 font-medium"
            >
              🏠 Accueil
            </TouchableOpacity>
            <Text style="text-gray-400">/</Text>
            <TouchableOpacity
              onClick={() => navigation.navigate('/dashboard/mes-services')}
              style="text-orange-600 hover:text-orange-800 font-medium"
            >
              📋 Mes Services
            </TouchableOpacity>
            <Text style="text-gray-400">/</Text>
            <Text style="text-gray-600 font-medium">
              {mode === 'readonly' ? 'Consultation du service' : 'Formulaire intelligent'} <Text style="inline-block align-middle">Yukpo</Text>
            </Text>
          </nav>

          {/* Indicateur de mode */}
          <View style="bg-white rounded-lg p-4 shadow-sm border">
            {type === 'creation_service' && (
              <View style="flex items-center gap-2 text-blue-600">
                <View style="w-2 h-2 bg-blue-600 rounded-full"></View>
                <h3 style="font-semibold text-blue-800 text-xs mb-0.5">🎯 Création de service détectée</h3>
              </View>
            )}
            
            {serviceId && (
              <View style="flex items-center gap-2 text-orange-600">
                <View style="w-2 h-2 bg-orange-600 rounded-full"></View>
                <h3 style="font-semibold text-orange-800 text-xs mb-0.5">✏️ Modification de service</h3>
              </View>
            )}
            
            {mode === 'readonly' && (
              <View style="flex items-center gap-2 text-green-600">
                <View style="w-2 h-2 bg-green-600 rounded-full"></View>
                <h3 style="font-semibold text-green-800 text-xs mb-0.5">👁️ Consultation en lecture seule</h3>
              </View>
            )}
          </View>
        </View>

        {/* Formulaire principal */}
        {composants.length > 0 ? (
          <View style="space-y-6">
            {/* Champs de base */}
            {champsRegroupes.base.length > 0 && (
              <View style="bg-gradient-to-r from-blue-50 to-indigo-50 rounded p-3 space-y-3 border border-blue-200">
                <h3 style="font-bold text-sm text-center text-blue-700 bg-blue-100 rounded py-1 mb-2">
                  📝 Informations générales
                </h3>
                
                <View style="space-y-3">
                  {champsRegroupes.base.map((champ: ComposantFrontend, index: number) => (
                    <DynamicField 
                      key={`${champ.nomChamp}-${index}`} 
                      champ={champ} 
                      valeurExistante={valeursFormulaire[champ.nomChamp]}
                      onChange={handleFieldChange}
                      readonly={mode === 'readonly'}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Liste produits */}
            {champsRegroupes.listeProduits && (
              <View style="bg-gray-50 rounded p-2">
                <DynamicField 
                  key={champsRegroupes.listeProduits.nomChamp} 
                  champ={champsRegroupes.listeProduits} 
                  valeurExistante={valeursFormulaire[champsRegroupes.listeProduits.nomChamp]}
                  onChange={handleFieldChange}
                  readonly={mode === 'readonly'}
                />
              </View>
            )}

            {/* Contact */}
            {champsRegroupes.contact.length > 0 && (
              <View style="bg-gray-50 rounded p-2 space-y-2">
                <h3 style="font-bold text-sm text-center text-orange-700 bg-orange-50 rounded py-1 mb-2">
                  📞 Contact
                </h3>
                {/* Dédoublonnage strict appliqué dans champsRegroupes.contact */}
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
              </View>
            )}

            {/* GPS fixe */}
            {champsRegroupes.gpsFixe && (
              <View style="bg-gray-50 rounded p-2">
                <DynamicField 
                  key={champsRegroupes.gpsFixe.nomChamp} 
                  champ={champsRegroupes.gpsFixe} 
                  valeurExistante={valeursFormulaire[champsRegroupes.gpsFixe.nomChamp]}
                  onChange={handleFieldChange}
                  readonly={mode === 'readonly'}
                />
              </View>
            )}

            {/* Autres champs */}
            {champsRegroupes.autres.length > 0 && (
              <View style="space-y-2">
                {champsRegroupes.autres.map((champ: ComposantFrontend, index: number) => (
                  <DynamicField 
                    key={`${champ.nomChamp}-${index}`} 
                    champ={champ} 
                    valeurExistante={valeursFormulaire[champ.nomChamp]}
                    onChange={handleFieldChange}
                    readonly={mode === 'readonly'}
                  />
                ))}
              </View>
            )}

            {/* Section GPS fixe - Localisation du service */}
            <View style="bg-gradient-to-r from-green-50 to-blue-50 rounded p-3 space-y-3 border border-green-200">
              <h3 style="font-bold text-sm text-center text-green-700 bg-green-100 rounded py-1 mb-2">
                📍 Localisation du service
              </h3>
              
              <View style="bg-white rounded p-2 border border-green-200">
                <label style="text-xs font-bold text-gray-700 mb-1 block">
                  🎯 Position GPS fixe (optionnel)
                </label>
                
                {/* Bouton de sélection GPS avec MapModal */}
                <View style="relative">
                  <TouchableOpacity
                    type="button"
                    onClick={() => mode !== 'readonly' && setShowMapModal(true)}
                    disabled={mode === 'readonly'}
                    style={`w-full flex items-center justify-between text-xs h-8 px-2 border border-gray-300 rounded transition-colors ${
                      mode === 'readonly'
                        ? 'bg-gray-50 cursor-not-allowed text-gray-600' 
                        : 'bg-white hover:bg-gray-50 focus:ring-1 focus:ring-green-400 focus:border-green-400'
                    }`}
                  >
                    <Text style="flex items-center gap-2">
                      <MapPin style="w-3 h-3 text-gray-500" />
                      {valeursFormulaire.gps_fixe ? 'Modifier la position' : 'Sélectionner une position'}
                    </Text>
                    <Text style="text-gray-400">▼</Text>
                  </TouchableOpacity>
                  
                  {/* Aperçu de la position si disponible */}
                  {valeursFormulaire.gps_fixe && (
                    <View style="mt-2 text-xs text-green-600">
                      ✅ Position GPS enregistrée: {valeursFormulaire.gps_fixe}
                    </View>
                  )}
                </View>
                
                <View style="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  💡 <strong>Conseil :</strong> Renseignez ce champ si votre service est basé dans un lieu fixe 
                  (boutique, bureau, atelier). Cela aide les clients à vous localiser plus facilement.
                </View>
                
                {/* MapModal pour la sélection GPS */}
                {showMapModal && mode !== 'readonly' && (
                  <MapModal
                    onClose={() => setShowMapModal(false)}
                    onSelect={(coords) => {
                      handleFieldChange('gps_fixe', coords);
                      setShowMapModal(false);
                    }}
                  />
                )}
              </View>
            </View>

            {/* Section Médias - Gestion unifiée des médias */}
            <MediaManager 
              mediaFiles={mediaFiles}
              onMediaChange={handleMediaChange}
              readonly={mode === 'readonly'}
            />
            
            {/* Section Promotion - Offres et réductions */}
            <View style="bg-gradient-to-r from-orange-50 to-red-50 rounded p-3 space-y-3 border border-orange-200">
              <h3 style="font-bold text-sm text-center text-orange-700 bg-orange-100 rounded py-1 mb-2">
                🎉 Promotion et Offres
              </h3>
              
              {/* Activation de la promotion */}
              <View style="bg-white rounded p-2 border border-orange-200">
                <label style="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                  <TextInput
                    type="checkbox"
                    checked={valeursFormulaire.promotion_active || false}
                    onChange={(e) => handleFieldChange('promotion_active', e.target.checked)}
                    disabled={mode === 'readonly'}
                    style="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  Activer une promotion pour ce service
                </label>
                
                {valeursFormulaire.promotion_active && (
                  <View style="space-y-3 mt-3">
                    {/* Type de promotion */}
                    <View>
                      <label style="text-xs font-bold text-gray-700 mb-1 block">
                        🏷️ Type de promotion
                      </label>
                      <select
                        value={valeursFormulaire.promotion_type || 'reduction'}
                        onChange={(e) => handleFieldChange('promotion_type', e.target.value)}
                        disabled={mode === 'readonly'}
                        style="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                      >
                        <option value="reduction">Réduction</option>
                        <option value="offre">Offre spéciale</option>
                        <option value="bon_plan">Bon plan</option>
                        <option value="flash">Offre flash</option>
                      </select>
                    </View>
                    
                    {/* Valeur de la promotion */}
                    <View>
                      <label style="text-xs font-bold text-gray-700 mb-1 block">
                        💰 Valeur de la promotion
                      </label>
                      <TextInput
                        type="text"
                        placeholder="ex: 20%, 50€, Gratuit"
                        value={valeursFormulaire.promotion_valeur || ''}
                        onChange={(e) => handleFieldChange('promotion_valeur', e.target.value)}
                        disabled={mode === 'readonly'}
                        style="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </View>
                    
                    {/* Description de la promotion */}
                    <View>
                      <label style="text-xs font-bold text-gray-700 mb-1 block">
                        📝 Description de la promotion
                      </label>
                      <textarea
                        placeholder="Décrivez votre offre promotionnelle..."
                        value={valeursFormulaire.promotion_description || ''}
                        onChange={(e) => handleFieldChange('promotion_description', e.target.value)}
                        disabled={mode === 'readonly'}
                        rows={2}
                        style="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </View>
                    
                    {/* Date de fin de promotion */}
                    <View>
                      <label style="text-xs font-bold text-gray-700 mb-1 block">
                        📅 Date de fin de promotion
                      </label>
                      <TextInput
                        type="date"
                        value={valeursFormulaire.promotion_date_fin || ''}
                        onChange={(e) => handleFieldChange('promotion_date_fin', e.target.value)}
                        disabled={mode === 'readonly'}
                        min={new Date().toISOString().split('T')[0]}
                        style="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </View>
                    
                    {/* Conditions de la promotion */}
                    <View>
                      <label style="text-xs font-bold text-gray-700 mb-1 block">
                        ⚠️ Conditions (optionnel)
                      </label>
                      <textarea
                        placeholder="Conditions spéciales, limitations..."
                        value={valeursFormulaire.promotion_conditions || ''}
                        onChange={(e) => handleFieldChange('promotion_conditions', e.target.value)}
                        disabled={mode === 'readonly'}
                        rows={2}
                        style="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </View>
                  </View>
                )}
                
                <View style="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  💡 <strong>Conseil :</strong> Les promotions attirent l'attention et peuvent augmenter vos chances d'être contacté. 
                  Pensez à des offres attractives comme des réductions, des services gratuits ou des bonus.
                </View>
              </View>
            </View>
            
            {/* Bouton de validation centré */}
            {composants.length > 0 && (
              <View style="flex justify-center pt-4">
                {mode === 'readonly' ? (
                  <TouchableOpacity 
                    onClick={() => navigation.navigate('/dashboard/mes-services')}
                    style="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 font-semibold"
                  >
                    🔙 Retour à mes services
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    onClick={handleValidationService}
                    disabled={chargement}
                    style="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-8 py-3 font-semibold shadow-lg"
                  >
                    {chargement ? (
                      <>
                        <View style="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></View>
                        Création en cours...
                      </>
                    ) : (
                      '🚀 Créer ce service'
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Statistique sur les champs générés intelligemment */}
        {/* (déplacé en haut) */}
      </View>
      
      {/* Composant GPS de test */}
      <GPSTestComponent />
    </AppLayout>
  );
} 
