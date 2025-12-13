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

  // Timeout de 30 secondes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    console.log('[searchService] Appel API recherche...');
    
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

    if (error.name === 'AbortError') {
      return {
        success: false,
        message: 'Timeout: La recherche a pris trop de temps. Veuillez réessayer.',
        error: 'TIMEOUT'
      };
    }

    console.error('[searchService] Erreur recherche:', error);
    return {
      success: false,
      message: error?.message || 'Une erreur est survenue lors de la recherche',
      error: 'NETWORK_ERROR'
    };
  }
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

