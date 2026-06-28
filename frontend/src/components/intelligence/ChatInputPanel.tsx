import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ImageIcon, Mic, Video, FileText, Sheet, Camera, MapPin, Globe, X, Loader2, Brain, Zap, Shield, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/buttons';
import { Tooltip } from '@/components/ui/tooltip';
import { MultiModalInput } from '@/types/yukpoIaClient';
import MapModal from '@/components/ui/MapModal';
import AudioRecorderModal from '@/components/ui/AudioRecorderModal';
import { useOptimizedApi } from '@/hooks/useOptimizedApi';
import { useFileUpload } from '@/hooks/useFileUpload';
import { YukpoBrand } from '@/components/Footer';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

interface UploadedFile {
  name: string;
  data: string;
  type: string;
}

// Optimisation: Fonction utilitaire memoïsée
const fileToUploadedFile = (file: File): Promise<UploadedFile> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      data: reader.result as string,
      type: file.type,
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

interface ChatInputPanelProps {
  onSubmit: (input: MultiModalInput) => void;
  loading: boolean;
  onInputChange?: (length: number) => void;
  showIASuggestion?: boolean;
}

const ChatInputPanel: React.FC<ChatInputPanelProps> = React.memo(({ onSubmit, loading, onInputChange, showIASuggestion }) => {
  const navigate = useNavigate();
  const [texte, setTexte] = useState('');
  const [site_web, setSiteWeb] = useState<string>('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [searchingAudio, setSearchingAudio] = useState(false);
  const [searchingVideo, setSearchingVideo] = useState(false);

  // Optimisation: État avec objets { nom, données, type }
  const [base64_image, setBase64Image] = useState<UploadedFile[]>([]);
  const [audio_base64, setAudio_base64] = useState<UploadedFile[]>([]);
  const [video_base64, setVideo_base64] = useState<UploadedFile[]>([]);
  const [doc_base64, setDoc_base64] = useState<UploadedFile[]>([]);
  const [excel_base64, setExcel_base64] = useState<UploadedFile[]>([]);
  
  // 🎨 Identité visuelle
  const [logo, setLogo] = useState<UploadedFile[]>([]);
  const [banner, setBanner] = useState<UploadedFile[]>([]);
  
  // --- Gestion GPS et Carte ---
  const [gps_zone, setGpsZone] = useState<{ lat: number; lng: number }[] | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [staticMapUrl, setStaticMapUrl] = useState<string | null>(null);

  // ?? NOUVEAU : Récupération automatique de la position GPS au chargement
  useEffect(() => {
    // Récupérer la position GPS actuelle de l'utilisateur
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('[ChatInputPanel] Position GPS récupérée:', coords);
          setGpsZone([coords]); // Stocker comme tableau pour compatibilité avec MapModal
        },
        (error) => {
          console.warn('[ChatInputPanel] Impossible d\'obtenir la position GPS:', error);
          // Ne pas afficher d'erreur à l'utilisateur, juste ignorer
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    }
  }, []); // Se déclenche une seule fois au chargement

  // --- Gestion Audio Modal ---
  const [showAudioModal, setShowAudioModal] = useState(false);

  // --- IA Ultra-Avancée ---
  const [aiInsights, setAiInsights] = useState<{
    confidence: number;
    suggestions: string[];
    complexity: string;
    estimatedTokens: number;
    intentPrediction: string;
    securityScore: number;
    optimizationTips: string[];
    modelRecommendation: string;
  } | null>(null);

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [aiModel, setAiModel] = useState<string>('auto');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(4000);

  // --- Hooks optimisés ---
  const { files: uploadedFiles, addFiles, isLoading: isUploading, errors: uploadErrors } = useFileUpload();
  
  // Hook pour l'analyse IA principale (production) - /api/ia/auto
  const { execute: executeMainIA, loading: isMainIALoading } = useOptimizedApi({ 
    url: '/api/ia/auto',
    method: 'POST',
    cache: { enabled: false }, // Pas de cache pour l'IA principale
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      'Content-Type': 'application/json'
    }
  });

  // Hook pour l'analyse de feedback UX (développement) - /api/ia/analyze
  const { execute: executeFeedbackIA, loading: isFeedbackIALoading } = useOptimizedApi({ 
    url: '/api/ia/analyze',
    method: 'POST',
    cache: { enabled: true, ttl: 300000 }, // 5 minutes pour le feedback
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      'Content-Type': 'application/json'
    }
  });

  // Détection de l'environnement
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Optimisation: Références pour éviter les re-créations
  const fileInputRefs = useRef<{
    image: HTMLInputElement | null;
    video: HTMLInputElement | null;
    doc: HTMLInputElement | null;
    excel: HTMLInputElement | null;
  }>({
    image: null,
    video: null,
    doc: null,
    excel: null,
  });

  // Optimisation: Callback memoïsé pour la gestion des fichiers
  const handleFile = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = await Promise.all(Array.from(files).map(fileToUploadedFile));
    setter((prev) => [...prev, ...newFiles]);
  }, []);

  // 🧠 Analyse IA ultra-avancée en temps réel du texte
  const analyzeTextWithAI = useCallback(async (text: string) => {
    if (text.length < 10) {
      setAiInsights(null);
      return;
    }

    // Empêche l'appel API si pas de token (non connecté)
    const token = localStorage.getItem('token');
    if (!token) {
      setAiInsights(null);
      return;
    }

    // En production, désactiver le feedback UX pour éviter les appels inutiles
    if (!isDevelopment) {
      console.log('[ChatInputPanel] Feedback UX désactivé en production');
      return;
    }

    try {
      const result = await executeFeedbackIA({
        data: { 
          text, 
          context: 'ultra_advanced_input_analysis',
          includeSecurity: true,
          includeOptimization: true,
          includeModelRecommendation: true
        }
      });

      if (result) {
        setAiInsights({
          confidence: result.confidence || 0.7,
          suggestions: result.suggestions || [],
          complexity: result.complexity || 'medium',
          estimatedTokens: result.estimatedTokens || text.length / 4,
          intentPrediction: result.intentPrediction || 'unknown',
          securityScore: result.securityScore || 0.9,
          optimizationTips: result.optimizationTips || [],
          modelRecommendation: result.modelRecommendation || 'auto'
        });
      }
    } catch (error) {
      console.warn('Erreur analyse IA ultra-avancée (feedback UX ignoré):', error);
      // Ne pas afficher d'erreur à l'utilisateur, juste ignorer le feedback
    }
  }, [executeFeedbackIA, isDevelopment]);

  // 🔄 Effet pour analyser le texte en temps réel
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (texte.trim()) {
        analyzeTextWithAI(texte);
      } else {
        setAiInsights(null);
      }
    }, 1000); // Délai de 1 seconde

    return () => clearTimeout(timeoutId);
  }, [texte, analyzeTextWithAI]);

  // Optimisation: Callback memoïsé pour la prise de photo
  const takePhoto = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const uploadedFile = await fileToUploadedFile(file);
        if (uploadedFile.name.startsWith('image.')) {
            uploadedFile.name = `photo-${Date.now()}.jpg`;
        }
        setBase64Image((prev) => [...prev, uploadedFile]);
      }
    };
    input.click();
  }, []);

  // Optimisation: Callback memoïsé pour supprimer un fichier
  const removeFile = useCallback((
    idx: number, 
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ) => {
    setter(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Optimisation: Callback memoïsé pour la confirmation audio
  const handleAudioConfirm = useCallback((audioFile: UploadedFile) => {
    setAudio_base64((prev) => [...prev, audioFile]);
  }, []);

  // Optimisation: Callback memoïsé pour la sélection de carte
  const handleMapSelect = useCallback((path: { lat: number; lng: number }[], previewUrl: string) => {
    setGpsZone(path);
    setStaticMapUrl(previewUrl);
  }, []);

  // Optimisation: Callback memoïsé pour la soumission
  const handleSubmit = useCallback(async () => {
    // Fonction pour extraire la partie base64 pure
    const extractBase64Data = (dataUrl: string): string => {
      // Si c'est déjà en base64 pur (pas de préfixe data:), retourner tel quel
      if (!dataUrl.startsWith('data:')) {
        return dataUrl;
      }
      // Extraire la partie base64 après le préfixe data:image/...;base64,
      const base64Index = dataUrl.indexOf('base64,');
      if (base64Index !== -1) {
        return dataUrl.substring(base64Index + 7);
      }
      return dataUrl; // Fallback
    };

    const input: MultiModalInput = {
      texte: texte.trim() || undefined,
      site_web: site_web || undefined,
      base64_image: base64_image.map(f => extractBase64Data(f.data)),
      audio_base64: audio_base64.length > 0 ? audio_base64.map(f => extractBase64Data(f.data)) : undefined,
      video_base64: video_base64.length > 0 ? video_base64.map(f => extractBase64Data(f.data)) : undefined,
      doc_base64: doc_base64.map(f => extractBase64Data(f.data)),
      excel_base64: excel_base64.map(f => extractBase64Data(f.data)),
      logo: logo.map(f => extractBase64Data(f.data)),
      banner: banner.map(f => extractBase64Data(f.data)),
      gps_mobile: gps_zone ? JSON.stringify(gps_zone) : undefined,
      // ?? NOUVEAU : Ajouter les champs GPS manquants
      gps_fixe: gps_zone ? true : undefined,
      gps_fixe_coords: gps_zone ? JSON.stringify(gps_zone) : undefined,
    };

    // Toujours utiliser onSubmit pour appeler Yukpo IA
    console.log('[ChatInputPanel] Appel onSubmit avec images:', base64_image.length);
    onSubmit(input);
  }, [texte, site_web, base64_image, audio_base64, video_base64, doc_base64, excel_base64, gps_zone, onSubmit]);

  // Optimisation: Callback memoïsé pour basculer l'input de lien
  const toggleLinkInput = useCallback(() => {
    setShowLinkInput((prev) => !prev);
  }, []);

  // Optimisation: Callback memoïsé pour ouvrir le modal de carte
  const openMapModal = useCallback(() => {
    setShowMapModal(true);
  }, []);

  // Optimisation: Callback memoïsé pour ouvrir le modal audio
  const openAudioModal = useCallback(() => {
    setShowAudioModal(true);
  }, []);

  // Optimisation: Calcul memoïsé pour déterminer s'il y a des éléments ajoutés
  const hasAddedElements = useMemo(() => {
    return base64_image.length > 0 || 
           doc_base64.length > 0 || 
           audio_base64.length > 0 || 
           video_base64.length > 0 || 
           excel_base64.length > 0 || 
           logo.length > 0 ||
           banner.length > 0 ||
           site_web || 
           gps_zone;
  }, [base64_image.length, doc_base64.length, audio_base64.length, video_base64.length, excel_base64.length, logo.length, banner.length, site_web, gps_zone]);

  // Optimisation: Calcul memoïsé pour le nombre total de fichiers
  const totalFiles = useMemo(() => {
    return base64_image.length + doc_base64.length + audio_base64.length + video_base64.length + excel_base64.length + logo.length + banner.length;
  }, [base64_image.length, doc_base64.length, audio_base64.length, video_base64.length, excel_base64.length, logo.length, banner.length]);

  // 🧠 Suggestion IA intelligente Yukpo (affichée si showIASuggestion)
  const showSuggestion = showIASuggestion && aiInsights && aiInsights.suggestions && aiInsights.suggestions.length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-white dark:bg-gray-900 rounded-xl shadow-md space-y-4">
      {/* Suggestions intelligentes Yukpo IA */}
      {showSuggestion && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex items-center gap-2">
          <Brain className="w-4 h-4 text-blue-600" />
          <div>
            <b><YukpoBrand className="inline" /> IA</b>
            <ul className="mt-1 list-disc list-inside text-blue-700">
              {aiInsights?.suggestions?.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 🧠 Barre d'outils IA avancée */}
      {false && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">IA Yukpo</span>
            {aiInsights && (
              <div className="flex items-center gap-2 text-xs">
                <div className={`px-2 py-1 rounded-full ${
                  aiInsights.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                  aiInsights.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  Confiance: {Math.round(aiInsights.confidence * 100)}%
                </div>
                <div className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  Complexité: {aiInsights.complexity}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⚙️ Options IA avancées */}
      {showAdvancedOptions && (
        <div className="bg-gray-50 p-3 rounded-lg space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Modèle IA
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full text-xs p-2 border rounded"
              >
                <option value="auto">Auto (recommandé)</option>
                <option value="gpt4">GPT-4 Turbo</option>
                <option value="gpt35">GPT-3.5 Turbo</option>
                <option value="claude">Claude 3</option>
                <option value="mistral">Mistral Large</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Créativité: {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tokens max: {maxTokens}
              </label>
              <input
                type="range"
                min="1000"
                max="8000"
                step="500"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* 💡 Suggestions IA (désactivé, doublon supprimé) */}
      {/*
      {aiInsights && aiInsights.suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Suggestions IA</span>
          </div>
          <div className="space-y-1">
            {aiInsights.suggestions.slice(0, 3).map((suggestion, index) => (
              <div key={index} className="text-xs text-blue-700 flex items-center gap-2">
                <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
      */}

      <textarea
        className="w-full p-3 border border-gray-300 rounded-md text-sm"
        placeholder="Décrivez votre besoin ici…"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          if (onInputChange) {
            onInputChange(e.target.value.length);
          }
        }}
        rows={3}
        disabled={loading || isMainIALoading}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!loading && !isMainIALoading && (texte.trim() || totalFiles > 0)) {
              handleSubmit();
            }
          }
        }}
      />

      <div className="flex items-center gap-4 flex-wrap justify-start">
        <Tooltip content="Ajouter des images">
          <label className="cursor-pointer">
            <ImageIcon className="w-6 h-6 text-blue-600 hover:text-blue-800" />
            <input 
              ref={(el) => fileInputRefs.current.image = el}
              type="file" 
              accept="image/*" 
              multiple 
              hidden 
              onChange={(e) => handleFile(e, setBase64Image)} 
            />
          </label>
        </Tooltip>

        <Tooltip content="Prendre une photo (caméra)">
          <button type="button" onClick={takePhoto}>
            <Camera className="w-6 h-6 text-green-600 hover:text-green-800" />
          </button>
        </Tooltip>

        <Tooltip content="Enregistrer un mémo vocal">
          <button type="button" onClick={openAudioModal}>
            <Mic className="w-6 h-6 text-purple-600 hover:text-purple-800" />
          </button>
        </Tooltip>

        <Tooltip content="Ajouter des vidéos">
          <label className="cursor-pointer">
            <Video className="w-6 h-6 text-red-600 hover:text-red-800" />
            <input 
              ref={(el) => fileInputRefs.current.video = el}
              type="file" 
              accept="video/*" 
              multiple 
              hidden 
              onChange={(e) => handleFile(e, setVideo_base64)} 
            />
          </label>
        </Tooltip>

        {/* ✅ NOUVEAU: Recherche par audio */}
        <Tooltip content="Rechercher par audio (transcription automatique)">
          <label className="cursor-pointer">
            {searchingAudio ? (
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            ) : (
              <Mic className="w-6 h-6 text-indigo-600 hover:text-indigo-800" />
            )}
            <input
              type="file"
              accept="audio/*"
              hidden
              disabled={searchingAudio}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setSearchingAudio(true);
                try {
                  const { audioSearchService } = await import('@/services/audioSearchService');
                  const result = await audioSearchService.searchByAudio({ audioFile: file });

                  if (result.success && result.results) {
                    // Afficher notification avec transcription
                    if (result.transcription?.text) {
                      toast.success(`🎤 Transcription: "${result.transcription.text.substring(0, 50)}..."`);
                    }

                    // Rediriger vers les résultats
                    navigate('/resultat-besoin', {
                      state: {
                        results: result.results,
                        type: 'recherche_besoin',
                        audioSearch: true,
                        audioTranscription: result.transcription,
                        billing: result.billing,
                      }
                    });
                  } else {
                    toast.error(result.error || 'Erreur lors de la recherche par audio');
                  }
                } catch (error: any) {
                  console.error('[ChatInputPanel] Erreur recherche audio:', error);
                  toast.error('Erreur lors de la recherche par audio');
                } finally {
                  setSearchingAudio(false);
                  // Réinitialiser l'input pour permettre de sélectionner le même fichier
                  e.target.value = '';
                }
              }}
            />
          </label>
        </Tooltip>

        {/* ✅ NOUVEAU: Recherche par vidéo */}
        <Tooltip content="Rechercher par vidéo (transcription automatique)">
          <label className="cursor-pointer">
            {searchingVideo ? (
              <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
            ) : (
              <Video className="w-6 h-6 text-red-600 hover:text-red-800" />
            )}
            <input
              type="file"
              accept="video/*"
              hidden
              disabled={searchingVideo}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setSearchingVideo(true);
                try {
                  // Vérifier la taille et le type
                  const { videoSearchService } = await import('@/services/videoSearchService');
                  const canProcess = videoSearchService.canProcessVideo(file.size, file.type);
                  
                  if (!canProcess.canProcess) {
                    toast.error(canProcess.error || 'Fichier vidéo non supporté');
                    return;
                  }

                  const result = await videoSearchService.searchByVideo({ videoFile: file });

                  if (result.success && result.results) {
                    // Afficher notification avec transcription
                    if (result.transcription?.text) {
                      toast.success(`🎥 Transcription: "${result.transcription.text.substring(0, 50)}..."`);
                    }

                    // Rediriger vers les résultats
                    navigate('/resultat-besoin', {
                      state: {
                        results: result.results,
                        type: 'recherche_besoin',
                        videoSearch: true,
                        videoTranscription: result.transcription,
                        billing: result.billing,
                      }
                    });
                  } else {
                    // Gestion erreur solde insuffisant
                    if (result.error?.includes('solde') || result.error?.includes('insufficient')) {
                      // 2026-06-28 — react-hot-toast n'a pas d'option onClick.
                      // Avant : `toast.error(msg, { onClick: ... })` cassait au tsc.
                      // Maintenant : toast info + navigation automatique différée
                      // pour laisser l'utilisateur lire le message avant le redirect.
                      toast.error(`${result.error} — redirection vers la recharge…`);
                      setTimeout(() => navigate('/recharge-tokens'), 1800);
                    } else {
                      toast.error(result.error || 'Erreur lors de la recherche par vidéo');
                    }
                  }
                } catch (error: any) {
                  console.error('[ChatInputPanel] Erreur recherche vidéo:', error);
                  toast.error('Erreur lors de la recherche par vidéo');
                } finally {
                  setSearchingVideo(false);
                  // Réinitialiser l'input pour permettre de sélectionner le même fichier
                  e.target.value = '';
                }
              }}
            />
          </label>
        </Tooltip>

        <Tooltip content="Ajouter une vidéo explicative">
          <label className="cursor-pointer">
            <Video className="w-6 h-6 text-pink-600 hover:text-pink-800" />
            <input 
              ref={(el) => fileInputRefs.current.video = el}
              type="file" 
              accept="video/*" 
              multiple 
              hidden 
              onChange={(e) => handleFile(e, setVideo_base64)} 
            />
          </label>
        </Tooltip>

        <Tooltip content="Ajouter des documents">
          <label className="cursor-pointer">
            <FileText className="w-6 h-6 text-orange-600 hover:text-orange-800" />
            <input 
              ref={(el) => fileInputRefs.current.doc = el}
              type="file" 
              accept=".pdf,.doc,.docx" 
              multiple 
              hidden 
              onChange={(e) => handleFile(e, setDoc_base64)} 
            />
          </label>
        </Tooltip>

        <Tooltip content="Ajouter un fichier Excel">
          <label className="cursor-pointer">
            <Sheet className="w-6 h-6 text-yellow-500 hover:text-yellow-700" />
            <input 
              ref={(el) => fileInputRefs.current.excel = el}
              type="file" 
              accept=".xlsx,.xls" 
              multiple 
              hidden 
              onChange={(e) => handleFile(e, setExcel_base64)} 
            />
          </label>
        </Tooltip>

        <Tooltip content="Ajouter un lien à analyser">
          <button type="button" onClick={toggleLinkInput}>
            <Globe className="w-6 h-6 text-gray-600 hover:text-blue-600" />
          </button>
        </Tooltip>

        <Tooltip content="Définir une zone GPS">
          <button type="button" onClick={openMapModal}>
            <MapPin className="w-6 h-6 text-green-600 hover:text-green-800" />
          </button>
        </Tooltip>

        <Button
          onClick={handleSubmit}
          disabled={loading || isMainIALoading || (!texte.trim() && totalFiles === 0)}
          className="ml-auto bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 text-white hover:from-blue-800 hover:to-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-blue-400 shadow-lg"
        >
          {(loading || isMainIALoading) && <Loader2 className="animate-spin" size={18} />}
          {loading || isMainIALoading ? "Analyse..." : "Envoyer à Yukpo"}
        </Button>
      </div>

      {/* CHAMP LIEN */}
      {showLinkInput && (
        <div className="pt-2">
          <input
            type="url"
            placeholder="Coller un lien (URL) à analyser..."
            className="w-full p-2 border rounded-md text-sm"
            value={site_web}
            onChange={(e) => setSiteWeb(e.target.value)}
          />
        </div>
      )}

      {/* APERÇUS - Optimisé avec memoïsation */}
      {hasAddedElements && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
            Éléments ajoutés ({totalFiles} fichier{totalFiles > 1 ? 's' : ''}) :
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Images */}
            {base64_image.map((file, idx) => (
              <div key={`img-${idx}`} className="relative group">
                <img
                  src={file.data}
                  alt={file.name}
                  className="w-full h-20 object-cover rounded border"
                />
                <button
                  onClick={() => removeFile(idx, setBase64Image)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
              </div>
            ))}

            {/* Documents */}
            {doc_base64.map((file, idx) => (
              <div key={`doc-${idx}`} className="relative group">
                <div className="w-full h-20 bg-gray-100 rounded border flex items-center justify-center">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <button
                  onClick={() => removeFile(idx, setDoc_base64)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
              </div>
            ))}

            {/* Audio */}
            {audio_base64.map((file, idx) => (
              <div key={`audio-${idx}`} className="relative group">
                <div className="w-full h-20 bg-purple-100 rounded border flex items-center justify-center">
                  <Mic className="w-8 h-8 text-purple-400" />
                </div>
                <button
                  onClick={() => removeFile(idx, setAudio_base64)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
              </div>
            ))}

            {/* Vidéos */}
            {video_base64.map((file, idx) => (
              <div key={`video-${idx}`} className="relative group">
                <div className="w-full h-20 bg-pink-100 rounded border flex items-center justify-center">
                  <Video className="w-8 h-8 text-pink-400" />
                </div>
                <button
                  onClick={() => removeFile(idx, setVideo_base64)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
              </div>
            ))}

            {/* Excel */}
            {excel_base64.map((file, idx) => (
              <div key={`excel-${idx}`} className="relative group">
                <div className="w-full h-20 bg-yellow-100 rounded border flex items-center justify-center">
                  <Sheet className="w-8 h-8 text-yellow-400" />
                </div>
                <button
                  onClick={() => removeFile(idx, setExcel_base64)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
              </div>
            ))}

            {/* Lien */}
            {site_web && (
              <div className="relative group">
                <div className="w-full h-20 bg-blue-100 rounded border flex items-center justify-center">
                  <Globe className="w-8 h-8 text-blue-400" />
                </div>
                <button
                  onClick={() => setSiteWeb('')}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">{site_web}</p>
              </div>
            )}

            {/* GPS */}
            {gps_zone && (
              <div className="relative group">
                <div className="w-full h-20 bg-green-100 rounded border flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-green-400" />
                </div>
                <button
                  onClick={() => {
                    setGpsZone(null);
                    setStaticMapUrl(null);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">Zone GPS définie</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showMapModal && (
        <MapModal
          onClose={() => setShowMapModal(false)}
          onSelect={handleMapSelect}
        />
      )}

      {showAudioModal && (
        <AudioRecorderModal
          onClose={() => setShowAudioModal(false)}
          onConfirm={handleAudioConfirm}
        />
      )}
    </div>
  );
});

ChatInputPanel.displayName = 'ChatInputPanel';

export default ChatInputPanel;
