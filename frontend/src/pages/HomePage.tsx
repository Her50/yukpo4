// ✅ HomePage.tsx — Design final Yukpo amélioré avec branding, AppLayout, animation centrale et orientation action immédiate
import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MultiModalInput } from '@/types/yukpoIaClient';
import { appelerMoteurIA, creerService } from '@/lib/yukpoaclient';
import ChatInputPanel from '@/components/intelligence/ChatInputPanel';
import AppLayout from '@/components/layout/AppLayout';
import YukpoIllustration from '@/assets/yukpo-illustration.svg';
import { useUser } from '@/hooks/useUser';
import type { IAResponseWithHeaders } from '@/lib/yukpoaclient';
import { GlobalIAStatsContext } from '@/components/intelligence/GlobalIAStats';
import { YukpoBrand } from '@/components/Footer';
import { ROUTES } from '@/routes/AppRoutesRegistry';
import { toast } from 'react-toastify';
import { genererSuggestionsService } from '@/lib/yukpoaclient';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [inputLength, setInputLength] = useState(0);
  const [isCreateService, setIsCreateService] = useState(false);
  const [showCreateServiceAlert, setShowCreateServiceAlert] = useState(false);
  const [pendingInput, setPendingInput] = useState<MultiModalInput | null>(null);
  const { user } = useUser();
  const { setStats } = useContext(GlobalIAStatsContext);

  const handleSubmit = async (input: MultiModalInput) => {
    try {
      setLoading(true);
      
      // Calculer la longueur de l'entrée pour l'estimation
      const textLength = input.text?.length || 0;
      const hasImage = input.images && input.images.length > 0;
      const hasAudio = input.audio ? 1 : 0;
      const hasFile = input.files && input.files.length > 0;
      const estimatedLength = textLength + (hasImage ? 100 : 0) + (hasAudio ? 150 : 0) + (hasFile ? 200 : 0);
      setInputLength(estimatedLength);
      setStats({
        confidence: 0,
        tokensUsed: 0,
        isProcessing: true,
        inputLength: estimatedLength,
      });
      
      console.log("[HomePage] Données envoyées à Yukpo:", input);
      
      // NOUVELLE LOGIQUE : Par défaut, tout est une recherche
      if (isCreateService) {
        // Si la case est cochée, demander confirmation
        setPendingInput(input);
        setShowCreateServiceAlert(true);
        setLoading(false);
        return;
      }
      
      // Par défaut : RECHERCHE DIRECTE (sans IA)
      await handleSearch(input);
      
    } catch (err: any) {
      setStats({
        confidence: 0,
        tokensUsed: 0,
        isProcessing: false,
        inputLength: 0,
      });
      console.error('❌ Erreur Yukpo détaillée:', err);
      if (err.response) {
        // Le serveur a répondu avec un code d'erreur (4xx, 5xx)
        console.error('Réponse du serveur:', err.response.data);
        console.error('Status:', err.response.status);
        console.error('Headers:', err.response.headers);
      } else if (err.request) {
        // La requête a été faite mais aucune réponse n'a été reçue
        console.error('Aucune réponse reçue, la requête était:', err.request);
      } else {
        // Une erreur s'est produite lors de la configuration de la requête
        console.error('Erreur de configuration de la requête:', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour gérer la recherche directe
  const handleSearch = async (input: MultiModalInput) => {
    try {
      // Appel direct à l'API de recherche (sans détection d'intention)
      const response = await fetch('/api/search/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(input)
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Mettre à jour les statistiques
      const confPercent = 0; // pas de confidence renvoyée par l'API directe
      setConfidence(confPercent);
      setTokensUsed(result.tokens_consumed || 0);
      setStats({
        confidence: confPercent,
        tokensUsed: result.tokens_consumed || 0,
        isProcessing: false,
        inputLength: inputLength,
      });
      
      // Rediriger vers les résultats de recherche
      const results = result?.resultats?.resultats || result?.resultats || [];
      navigate('/resultat-besoin', {
        state: {
          results: results,
          type: 'recherche_besoin',
          suggestion: result
        }
      });
    } catch (err: any) {
      console.error('Erreur lors de la recherche:', err);
      setStats({
        confidence: 0,
        tokensUsed: 0,
        isProcessing: false,
        inputLength: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour gérer la création de service
  const handleCreateService = async (input: MultiModalInput) => {
    try {
      // ?? CORRECTION : Appeler une fonction de génération de suggestions au lieu de créer le service
      // ?? L'ancienne fonction creerService créait le service dans PostgreSQL, ce qui est incorrect
      const result = await genererSuggestionsService(input) as IAResponseWithHeaders;
      
      // ?? NOUVEAU : Extraire les médias de la réponse pour les transmettre au formulaire
      const mediaData = {
        base64_image: result.data.service_data?.base64_image || input.base64_image,
        audio_base64: result.data.service_data?.audio_base64 || input.audio_base64,
        video_base64: result.data.service_data?.video_base64 || input.video_base64,
        doc_base64: result.data.service_data?.doc_base64 || input.doc_base64,
        excel_base64: result.data.service_data?.excel_base64 || input.excel_base64,
        pdf_base64: result.data.service_data?.pdf_base64 || input.pdf_base64
      };

      // ?? NOUVEAU : Extraire les données GPS pour les transmettre au formulaire
      const gpsData = {
        gps_mobile: input.gps_mobile,
        gps_zone: input.gps_zone,
        gps_fixe: input.gps_fixe,
        gps_fixe_coords: input.gps_fixe_coords
      };

      console.log('[HomePage] Données GPS extraites:', gpsData);

      // Rediriger vers le formulaire de création avec les médias
      navigate('/formulaire-yukpo-intelligent', { 
        state: { 
          suggestion: {
            ...result.data,
            intention: 'creation_service', // ?? AJOUT : Propriété intention manquante
            data: result.data.suggestions || result.data.data || result.data
          },
          type: 'creation_service',
          mediaData: mediaData, // ?? NOUVEAU : Transmettre les médias
          gpsData: gpsData // ?? NOUVEAU : Transmettre les données GPS
        } 
      });
    } catch (error) {
      console.error('Erreur lors de la génération des suggestions:', error);
      toast.error('Erreur lors de la génération des suggestions');
    }
  };

  // Fonction pour confirmer la création de service
  const confirmCreateService = () => {
    if (pendingInput) {
      setLoading(true);
      handleCreateService(pendingInput);
      setShowCreateServiceAlert(false);
      setPendingInput(null);
    }
  };

  // Fonction pour annuler la création de service
  const cancelCreateService = () => {
    if (pendingInput) {
      handleSearch(pendingInput);
      setShowCreateServiceAlert(false);
      setPendingInput(null);
    }
  };

  // Mettre à jour la longueur de l'entrée quand l'utilisateur tape
  const handleInputChange = (length: number) => {
    setInputLength(length);
  };

  return (
    <AppLayout padding={false}>
      {/* Panneau de statistiques IA miniaturisé en position fixe */}
      {/* <div className="fixed top-24 left-4 z-40">
        <IAStatsPanel 
          confidence={confidence}
          tokensUsed={tokensUsed}
          isProcessing={loading}
          inputLength={inputLength}
          miniMode={true}
        />
      </div> */}
      
      <main className="flex flex-col items-center justify-center px-4 sm:px-6 py-20 text-center min-h-[calc(100vh-4rem)]">
        <motion.div
          className="space-y-8 max-w-4xl w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Titre et description */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold">
              <YukpoBrand />
            </h1>
            <p className="text-gray-700 dark:text-gray-300 text-lg sm:text-xl font-medium max-w-2xl mx-auto">
              Créez ou trouvez un service en un instant.
              <br className="hidden sm:block" />
              <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Une description, une image, un audio ou un fichier suffit.
              </span>
            </p>
          </div>

          {/* Case à cocher pour création de service */}
          <div className="mt-8 flex items-center justify-center">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCreateService}
                onChange={(e) => setIsCreateService(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Je souhaite créer un service/prestation
              </span>
            </label>
          </div>

          {/* ChatInputPanel en focus principal */}
          <div className="mt-8">
            <ChatInputPanel 
              onSubmit={handleSubmit} 
              loading={loading}
              onInputChange={handleInputChange}
              showIASuggestion={true}
            />
          </div>

          {/* Indicateurs visuels subtils */}
          <motion.div 
            className="flex justify-center gap-8 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className="text-center">
              <div className="text-2xl mb-1">🎯</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Détection intelligente</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">⚡</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Traitement rapide</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">🔐</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">100% sécurisé</p>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Alerte de confirmation pour création de service */}
      {showCreateServiceAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Confirmation de création de service
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Êtes-vous sûr de vouloir créer un service/prestation sur la plateforme ?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={confirmCreateService}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Ouverture…' : 'Oui, créer un service'}
              </button>
              <button
                onClick={cancelCreateService}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                Non, rechercher
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default HomePage;
