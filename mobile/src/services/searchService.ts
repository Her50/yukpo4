/**
 * Service de recherche simple et efficace
 * Refonte complète pour corriger les problèmes de performance et d'affichage
 */

import { API_BASE_URL } from '../config/api';
import SafeStorage from '../utils/safeStorage';

export interface SearchInput {
  texte?: string;
  text?: string;
  description?: string;
  base64_image?: string[];
  audio_base64?: string[];
  video_base64?: string[];
  gps_mobile?: string;
  gps_fixe?: string;
  user_id?: string;
}

export interface SearchResult {
  service_id: number | string;
  data: any;
  score?: number;
  distance?: number;
  gps?: string;
}

export interface SearchResponse {
  success: boolean;
  resultats?: SearchResult[];
  results?: SearchResult[];
  nombre_matchings?: number;
  message?: string;
  error?: string;
}

/**
 * Récupère le token d'authentification
 */
async function getAuthToken(): Promise<string | null> {
  try {
    let token = await SafeStorage.getItem('auth_token');
    if (!token) {
      token = await SafeStorage.getItem('token');
    }
    return token;
  } catch (error) {
    console.error('[searchService] Erreur récupération token:', error);
    return null;
  }
}

/**
 * Recherche simple et directe de services
 * Support texte, image et audio
 */
export async function searchServices(input: SearchInput): Promise<SearchResponse> {
  const token = await getAuthToken();
  
  if (!token) {
    return {
      success: false,
      message: 'Token d\'authentification manquant',
      error: 'AUTH_REQUIRED'
    };
  }

  // Préparer le payload
  const payload: any = {
    texte: input.texte || input.text || input.description || '',
  };

  // Ajouter les médias si présents
  if (input.base64_image && input.base64_image.length > 0) {
    payload.base64_image = input.base64_image;
  }
  
  if (input.audio_base64 && input.audio_base64.length > 0) {
    payload.audio_base64 = input.audio_base64;
  }
  
  if (input.video_base64 && input.video_base64.length > 0) {
    payload.video_base64 = input.video_base64;
  }

  // Ajouter GPS si présent (seulement gps_mobile est accepté par le backend)
  if (input.gps_mobile) {
    payload.gps_mobile = input.gps_mobile;
  }
  
  // Note: gps_fixe n'est pas utilisé dans la recherche, seulement dans les services

  // Ajouter user_id si présent
  if (input.user_id) {
    payload.user_id = input.user_id;
  }

  // ✅ CORRIGÉ: Timeout augmenté à 60 secondes pour gérer les recherches avec images (analyse IA peut prendre 20-30s)
  // ✅ CORRIGÉ: Ajout d'un système de retry pour gérer les erreurs réseau temporaires (cold start Render, etc.)
  const maxRetries = 3;
  const retryDelay = 2000; // 2 secondes entre les tentatives
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes

    try {
      console.log(`[searchService] Appel API recherche... (tentative ${attempt}/${maxRetries})`);
      
      const response = await fetch(`${API_BASE_URL}/api/search/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Erreur HTTP: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // Ignorer si pas de JSON
        }
        
        // ✅ AMÉLIORÉ: Messages d'erreur spécifiques pour les erreurs courantes
        if (response.status === 502) {
          errorMessage = 'Le serveur est temporairement indisponible (Bad Gateway). Cela peut être dû à un démarrage du serveur ou à une surcharge.';
        } else if (response.status === 503) {
          errorMessage = 'Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.';
        } else if (response.status === 504) {
          errorMessage = 'Le serveur a pris trop de temps à répondre (Gateway Timeout).';
        } else if (response.status === 500) {
          errorMessage = 'Une erreur interne du serveur s\'est produite.';
        } else if (response.status === 408) {
          errorMessage = 'La requête a pris trop de temps (Timeout).';
        }
        
        // ✅ CORRIGÉ: Retry uniquement pour les erreurs 5xx (erreurs serveur) et 408 (timeout)
        // L'erreur 502 (Bad Gateway) est souvent temporaire (cold start Render, surcharge)
        if ((response.status >= 500 || response.status === 408) && attempt < maxRetries) {
          const retryMessage = response.status === 502 
            ? `⚠️ Erreur 502 (Bad Gateway) - probablement un cold start, retry dans ${retryDelay}ms...`
            : `⚠️ Erreur ${response.status}, retry dans ${retryDelay}ms...`;
          console.warn(`[searchService] ${retryMessage}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        return {
          success: false,
          message: errorMessage,
          error: `HTTP_${response.status}`
        };
      }

      const result = await response.json();
      console.log('[searchService] Réponse reçue:', {
        hasResultats: !!result.resultats,
        hasResults: !!result.results,
        type: typeof result.resultats
      });

      // Normaliser la réponse
      let results: SearchResult[] = [];
      
      // Cas 1: result.resultats est un array
      if (Array.isArray(result.resultats)) {
        results = result.resultats;
      }
      // Cas 2: result.resultats.resultats est un array (structure imbriquée)
      else if (result.resultats && typeof result.resultats === 'object' && Array.isArray(result.resultats.resultats)) {
        results = result.resultats.resultats;
      }
      // Cas 3: result.results est un array
      else if (Array.isArray(result.results)) {
        results = result.results;
      }
      // Cas 4: result.data.resultats
      else if (result.data && Array.isArray(result.data.resultats)) {
        results = result.data.resultats;
      }
      // Cas 5: result.data est un array
      else if (Array.isArray(result.data)) {
        results = result.data;
      }

      console.log('[searchService] Résultats normalisés:', results.length);

      // Mettre à jour le solde de tokens si présent
      const remaining = response.headers.get('x-tokens-remaining');
      if (remaining) {
        await SafeStorage.setItem('tokens_balance', remaining);
      }

      return {
        success: true,
        resultats: results,
        results: results,
        nombre_matchings: results.length,
        message: result.message || `${results.length} résultat(s) trouvé(s)`
      };

    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;

      if (error.name === 'AbortError') {
        // ✅ CORRIGÉ: Retry pour timeout si ce n'est pas la dernière tentative
        if (attempt < maxRetries) {
          console.warn(`[searchService] ⚠️ Timeout, retry dans ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        return {
          success: false,
          message: 'Timeout: La recherche a pris trop de temps. Veuillez vérifier votre connexion internet et réessayer.',
          error: 'TIMEOUT'
        };
      }

      // ✅ CORRIGÉ: Retry pour erreurs réseau si ce n'est pas la dernière tentative
      const isNetworkError = error?.message?.includes('Network request failed') || 
                            error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('network') ||
                            error?.name === 'TypeError';
      
      if (isNetworkError && attempt < maxRetries) {
        console.warn(`[searchService] ⚠️ Erreur réseau (${error?.message || error?.name}), retry dans ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // Si c'est la dernière tentative ou une erreur non-réessayable, retourner l'erreur
      console.error(`[searchService] Erreur recherche (tentative ${attempt}/${maxRetries}):`, error);
      
      return {
        success: false,
        message: error?.message || 'Une erreur est survenue lors de la recherche. Veuillez vérifier votre connexion internet.',
        error: isNetworkError ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR'
      };
    }
  }

  // Ne devrait jamais arriver ici, mais au cas où
  return {
    success: false,
    message: lastError?.message || 'Échec de la recherche après plusieurs tentatives. Veuillez réessayer plus tard.',
    error: 'MAX_RETRIES_EXCEEDED'
  };
}

/**
 * Recherche par image uniquement
 */
export async function searchByImage(imageBase64: string[], gps?: string): Promise<SearchResponse> {
  return searchServices({
    texte: '',
    base64_image: imageBase64,
    gps_mobile: gps
  });
}

/**
 * Recherche par audio uniquement
 */
export async function searchByAudio(audioBase64: string[], gps?: string): Promise<SearchResponse> {
  return searchServices({
    texte: '',
    audio_base64: audioBase64,
    gps_mobile: gps
  });
}

/**
 * Recherche texte simple
 */
export async function searchByText(text: string, gps?: string): Promise<SearchResponse> {
  return searchServices({
    texte: text,
    gps_mobile: gps
  });
}

export default {
  searchServices,
  searchByImage,
  searchByAudio,
  searchByText
};

