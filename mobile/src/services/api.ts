// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../utils/safeStorage';

import { GeneratedVideoResponse, VideoCostEstimation, VideoGenerationPayload } from '../types/VideoGeneration';
import type { CreateVoiceProfilePayload } from '../types/audio';
import {
  DeliveryLocationUpdatePayload,
  DeliveryRecipientPayload,
  ShoppingOrderPayload,
} from '../types/delivery';

// Configuration de base - Valeurs par défaut
import { config } from '../config/environment';

// Utilise la configuration centralisée

// Gestionnaire d'erreurs - Fallback
const errorHandler = {
  handleApiError: (error: any, context?: string) => ({
    message: error?.message || 'Une erreur inattendue s\'est produite',
    status: 500,
    code: 'UNKNOWN_ERROR'
  })
};

const API_BASE_URL = config.API_BASE_URL;

// ✅ AMÉLIORÉ: Types pour les réponses API avec codes d'erreur
interface ApiResponse<T = any> {
  data?: T;
  success?: boolean;
  message?: string;
  error?: string;
  status?: number; // ✅ NOUVEAU 2025-12-11: Status HTTP pour gestion spécifique des erreurs
  code?: string; // ✅ NOUVEAU: Code d'erreur pour gestion spécifique
  [key: string]: any; // Permettre l'accès dynamique aux propriétés de la réponse
}

export interface UploadedMediaItem {
  id: number;
  path: string;
  media_type: string;
}

export interface ContentAnalyticsSummary {
  days: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avg_view_duration_ms: number;
}

export interface ContentAnalyticsBreakdownItem {
  content_type: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avg_view_duration_ms: number;
}

export interface ContentAnalyticsTopItem {
  content_id: string;
  content_type: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avg_view_duration_ms: number;
  likes: number;
  saves: number;
  last_seen: string | null;
}

export interface ContentAnalyticsApiData {
  summary: ContentAnalyticsSummary;
  breakdown: ContentAnalyticsBreakdownItem[];
  top_content: ContentAnalyticsTopItem[];
}

export interface ContentAnalyticsApiResponse {
  success: boolean;
  data: ContentAnalyticsApiData;
}

export interface VideoAnalyticsOverview {
  horizon_days: number;
  videos_generated: number;
  total_views: number;
  total_shares: number;
  average_quality_score: number;
  distribution_success: number;
  distribution_pending: number;
}

export interface VideoAnalyticsOverviewResponse {
  success: boolean;
  data: VideoAnalyticsOverview;
}

export interface VideoJobProgressStep {
  key: string;
  label: string;
  status: string;
  detail?: string | null;
}

export interface VideoJobStatus {
  job_id: string;
  user_id: number;
  service_id?: number | null;
  product_index?: number | null;
  status: string;
  progress_steps: VideoJobProgressStep[];
  result_media_id?: number | null;
  error_message?: string | null;
  result_payload?: GeneratedVideoResponse | null;
  created_at: string;
  updated_at: string;
}

export interface StartVideoJobResponse {
  job_id: string;
  status: string;
}

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
// Fonction pour récupérer le token d'authentification
const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SafeStorage.getItem('auth_token');
  } catch (error) {
    console.error('Erreur récupération token:', error);
    return null;
  }
};

// Fonction pour sauvegarder le token d'authentification
const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await SafeStorage.setItem('auth_token', token);
  } catch (error) {
    console.error('Erreur sauvegarde token:', error);
  }
};

// Fonction pour supprimer le token
const removeAuthToken = async (): Promise<void> => {
  try {
    await SafeStorage.removeItem('auth_token');
  } catch (error) {
    console.error('Erreur suppression token:', error);
  }
};

// ✅ NOUVEAU: Refresh proactif du token JWT avant expiration
let isRefreshing = false;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes avant expiration

const decodeJwtExp = (token: string): number | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 : null; // en ms
  } catch { return null; }
};

const ensureValidToken = async (): Promise<string | null> => {
  try {
    const token = await getAuthToken();
    if (!token) return null;

    const expMs = decodeJwtExp(token);
    if (!expMs) return token; // Impossible de décoder, utiliser tel quel

    const now = Date.now();
    const timeLeft = expMs - now;

    // Token déjà expiré
    if (timeLeft <= 0) {
      console.warn('[API] ⚠️ Token expiré, suppression');
      await removeAuthToken();
      return null;
    }

    // Token va expirer bientôt → refresh proactif
    if (timeLeft < TOKEN_REFRESH_MARGIN_MS && !isRefreshing) {
      isRefreshing = true;
      console.log('[API] \uD83D\uDD04 Refresh proactif du token (expire dans', Math.round(timeLeft / 1000), 's)');
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.token) {
            await saveAuthToken(data.token);
            console.log('[API] ✅ Token rafraîchi avec succès');
            isRefreshing = false;
            return data.token;
          }
        }
        // Si le refresh échoue, utiliser l'ancien token tant qu'il est encore valide
        console.warn('[API] ⚠️ Refresh échoué, utilisation du token existant');
      } catch (refreshErr) {
        console.warn('[API] ⚠️ Erreur refresh token:', refreshErr);
      }
      isRefreshing = false;
    }

    return token;
  } catch {
    return await getAuthToken();
  }
};

// ✅ NOUVEAU: Système de retry avec backoff exponentiel
interface RetryConfig {
  maxRetries?: number;
  retryableStatuses?: number[];
  retryableErrors?: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, Too Many Requests, Server Errors
  retryableErrors: ['Network request failed', 'Failed to fetch', 'AbortError'],
};

const shouldRetry = (error: any, status?: number, config: RetryConfig = DEFAULT_RETRY_CONFIG, endpoint?: string): boolean => {
  // ✅ AMÉLIORÉ 2026-01-06: Ne pas retry les timeouts sur les endpoints IA longs
  // Si c'est un timeout sur un endpoint qui a déjà un timeout long (120s+), 
  // retry ne servira probablement pas (le backend a vraiment un problème)
  const isLongTimeoutEndpoint = endpoint && (
    endpoint.includes('/menus/ai/generate-week') ||
    endpoint.includes('/menus/ai/generate-recipe') ||
    endpoint.includes('/preview') ||
    endpoint.includes('/preview/short') ||
    endpoint.includes('/services/create')
  );

  // ✅ NOUVEAU: Retry pour les codes d'erreur spécifiques (TIMEOUT, NETWORK_ERROR)
  // Mais pas pour les endpoints avec timeout long (timeout réel = problème backend)
  if (error?.code === 'TIMEOUT') {
    // Pour les endpoints avec timeout long, ne pas retry (problème backend réel)
    if (isLongTimeoutEndpoint) {
      return false;
    }
    // Pour les autres endpoints, retry (peut être erreur réseau temporaire)
    return true;
  }

  if (error?.code === 'NETWORK_ERROR') {
    return true;
  }

  // Ne pas retry pour les erreurs 4xx (sauf 408, 429)
  if (status && status >= 400 && status < 500 && !config.retryableStatuses?.includes(status)) {
    return false;
  }

  // Retry pour les erreurs réseau (vérifier message et toString)
  const errorMessage = error?.message || error?.error || error?.toString() || '';
  if (config.retryableErrors?.some(err => errorMessage.includes(err))) {
    // ✅ AMÉLIORÉ: Ne pas retry AbortError sur endpoints avec timeout long
    if (errorMessage.includes('AbortError') && isLongTimeoutEndpoint) {
      return false;
    }
    return true;
  }

  // Retry pour les statuts HTTP retryables
  if (status && config.retryableStatuses?.includes(status)) {
    return true;
  }

  return false;
};

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// ✅ NOUVEAU: Fonction de retry avec backoff exponentiel
const apiCallWithRetry = async <T>(
  endpoint: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<ApiResponse<T>> => {
  const maxRetries = retryConfig.maxRetries ?? 3;
  let lastError: any = null;
  let lastStatus: number | undefined = undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCallInternal<T>(endpoint, options);

      // Si succès, retourner immédiatement
      if (result.success !== false && (!result.status || result.status < 400)) {
        return result;
      }

      // Si erreur, vérifier si on doit retry
      lastStatus = result.status;
      // ✅ AMÉLIORÉ: Passer aussi le code d'erreur et l'endpoint à shouldRetry
      const errorToCheck = { ...result, error: result.error || result, code: result.code };

      // ✅ CORRIGÉ: Vérifier si on doit retry AVANT de retourner l'erreur
      if (attempt < maxRetries && shouldRetry(errorToCheck, lastStatus, retryConfig, endpoint)) {
        // Calculer le délai avec backoff exponentiel (1s, 2s, 4s)
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s
        console.log(`[Mobile API] ⚠️ Retry ${attempt + 1}/${maxRetries} après ${delayMs}ms pour ${endpoint} (code: ${result.code || 'N/A'}, status: ${result.status || 'N/A'})`);
        await delay(delayMs);
        continue;
      }

      // Ne pas retry, retourner l'erreur
      if (attempt === maxRetries) {
        console.error(`[Mobile API] ❌ Tous les retries ont échoué pour ${endpoint} (code: ${result.code || 'N/A'})`);
      }
      return result;
    } catch (error: any) {
      lastError = error;

      // Vérifier si on doit retry
      if (attempt < maxRetries && shouldRetry(error, undefined, retryConfig, endpoint)) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[Mobile API] Retry ${attempt + 1}/${maxRetries} après ${delayMs}ms pour ${endpoint}`);
        await delay(delayMs);
        continue;
      }

      // Ne pas retry, lancer l'erreur
      throw error;
    }
  }

  // Si on arrive ici, tous les retries ont échoué
  if (lastError) {
    throw lastError;
  }

  return {
    success: false,
    error: 'Tous les tentatives ont échoué',
    status: lastStatus,
    data: null,
  };
};

// ✅ NOUVEAU: Fonction interne pour les appels API (sans retry)
const apiCallInternal = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  // ✅ Utiliser ensureValidToken pour refresh proactif avant expiration
  const token = await ensureValidToken();

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Yukpo-Mobile/1.0.0',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    // Vérifier si fetch est disponible
    if (typeof fetch !== 'function') {
      throw new Error('Fetch API non disponible');
    }

    // Debug: Log the URL being used
    console.log(`[Mobile API] Making request to: ${API_BASE_URL}${endpoint}`);
    console.log(`[Mobile API] Request headers:`, config.headers);

    // ✅ CORRECTION: Timeout adaptatif selon l'endpoint
    const controller = new AbortController();
    // Timeout adapté pour création service (upload médias + vectorisation + IA)
    // 180s (3 min) nécessaire pour :
    // - Upload 60-100 MB en 3G : 96-160s
    // - Traitement backend : 20-50s
    // ✅ AUGMENTÉ: 90s pour création-service (appel IA OpenAI avec images peut prendre 15-30s + traitement images)
    // ✅ CORRECTION: 90s pour création produit (upload médias peut prendre du temps)
    // ✅ CORRIGÉ: 60s pour timeline-variants (génération IA peut prendre 30-50s)
    // ✅ CORRIGÉ: 30s pour /prestataire/services (peut prendre du temps avec cache Redis)
    // ✅ CORRIGÉ 2025-12-23: 30s pour /api/search/direct (recherche par image peut prendre 20-25s avec analyse IA)
    // ✅ CORRIGÉ 2025-12-23: 30s pour /api/mobile-logs (traitement batch peut prendre du temps)
    // ✅ CORRIGÉ 2025-12-23: 30s pour /api/services/*/reviews et /stats (peuvent être lents)
    // ✅ CORRIGÉ 2026-01-02: 120s (2min) pour preview/short (génération vidéo peut prendre 60-90s)
    // ✅ CORRIGÉ 2026-01-06: 120s (2min) pour /api/menus/ai/generate-week (génération menu IA peut prendre 60-90s avec géocodage + IA)
    // ✅ CORRIGÉ 2026-01-07: 90s pour /api/menus/ai/generate-recipe (génération recette IA peut prendre 30-60s)
    // ✅ CORRIGÉ 2026-01-08: 90s pour analyse d'images IA (hôpital, laboratoire, pharmacie) - peut prendre 30-60s
    // ✅ CORRIGÉ 2026-01-08: 60s pour recherche pathologie IA et autres fonctionnalités IA médicales
    const timeoutDuration = endpoint.includes('/navigation/activity/ai-insights')
      ? 90000  // ✅ CORRIGÉ 2026-03-15: 90s pour Coach IA navigation (DB queries + calculs + appel LLM peut prendre 30-60s)
      : endpoint.includes('/navigation/checkpoints/ai-analysis')
        ? 60000  // ✅ CORRIGÉ 2026-03-15: 60s pour analyse IA checkpoints (requêtes DB + LLM)
        : endpoint.includes('/menus/ai/generate-week')
          ? 120000  // ✅ CORRIGÉ 2026-01-06: 120s (2min) pour génération menu IA (géocodage + DB + IA peut prendre 60-90s)
          : endpoint.includes('/menus/ai/generate-recipe')
            ? 90000  // ✅ CORRIGÉ 2026-01-07: 90s pour génération recette IA (peut prendre 30-60s)
            : endpoint.includes('/examinations/analyze-image') || endpoint.includes('/search/by-image')
              ? 90000  // ✅ CORRIGÉ 2026-01-08: 90s pour analyse d'images IA (peut prendre 30-60s avec traitement IA)
              : endpoint.includes('/ai/search-pathology') || endpoint.includes('/ai/interactions') || endpoint.includes('/ai/dosage')
                ? 60000  // ✅ CORRIGÉ 2026-01-08: 60s pour recherche pathologie IA et autres fonctionnalités IA médicales
                : endpoint.includes('/services/create')
                  ? 180000
                  : endpoint.includes('/ia/creation-service')
                    ? 90000  // ✅ AUGMENTÉ: 90s pour supporter traitement images + appel IA multimodal
                    : endpoint.includes('/ia/video/timeline-variants')
                      ? 60000  // ✅ 60s pour timeline-variants (génération de variantes peut prendre du temps)
                      : endpoint.includes('/services/') && endpoint.includes('/products')
                        ? 180000  // ✅ AUGMENTÉ: 180s (3min) pour création/modification produit (le backend peut prendre du temps même sans médias)
                        : endpoint.includes('/preview') || endpoint.includes('/preview/short')
                          ? 120000  // ✅ CORRIGÉ 2026-01-02: 120s (2min) pour preview (génération vidéo peut prendre 60-90s)
                          : endpoint.includes('/search/direct')
                            ? 30000  // ✅ 30s pour recherche par image (analyse IA + recherche SQL peut prendre 20-25s)
                            : endpoint.includes('/mobile-logs')
                              ? 60000  // ✅ CORRIGÉ 2026-01-12: 60s pour logs mobiles (traitement batch peut prendre du temps, éviter AbortError)
                              : endpoint.includes('/services/') && (endpoint.includes('/reviews') || endpoint.includes('/stats'))
                                ? 30000  // ✅ 30s pour reviews et stats (peuvent être lents)
                                : endpoint.includes('/prestataire/services')
                                  ? 30000  // ✅ 30s pour chargement services (peut être lent avec cache Redis)
                                  : 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...config,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Vérifier si le token a été mis à jour
    const newToken = response.headers.get('x-new-jwt');
    if (newToken) {
      await saveAuthToken(newToken);
    }

    // Vérifier le solde de tokens
    const tokensRemaining = response.headers.get('x-tokens-remaining');
    if (tokensRemaining) {
      await SafeStorage.setItem('tokens_balance', tokensRemaining);
    }

    let data;
    // ✅ CORRIGÉ 2025-11-28: Gérer les réponses 404 et autres erreurs avant parsing JSON
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const contentLength = response.headers.get('content-length');
    // ✅ CORRECTION CRITIQUE: Ne pas se fier uniquement à content-length
    // Si Content-Type est application/json, on doit essayer de parser même sans content-length
    const hasBody = contentLength !== '0' && contentLength !== null;
    const shouldTryParseJson = isJson && (hasBody || response.ok); // Essayer si JSON ou si réponse OK

    // ✅ DEBUG: Log pour /api/auth/login
    if (endpoint === '/api/auth/login') {
      console.log(`[Mobile API] ✅ Status: ${response.status} ${response.statusText}`);
      console.log(`[Mobile API] ✅ Content-Type:`, contentType);
      console.log(`[Mobile API] ✅ Content-Length:`, contentLength);
      console.log(`[Mobile API] ✅ Response OK:`, response.ok);
      console.log(`[Mobile API] ✅ Has Body (from header):`, hasBody);
      console.log(`[Mobile API] ✅ Is JSON:`, isJson);
      console.log(`[Mobile API] ✅ Should try parse JSON:`, shouldTryParseJson);
    }

    // Si c'est une erreur 404 ou 500 sans body, ne pas essayer de parser JSON
    if (!response.ok && (!hasBody || !isJson)) {
      const statusText = response.statusText || `Erreur ${response.status}`;
      return {
        success: false,
        error: statusText,
        data: { status: response.status, message: statusText } as T,
      };
    }

    // ✅ CORRIGÉ: Cloner la réponse avant de la lire pour éviter "Already read"
    const responseClone = response.clone();

    try {
      // ✅ CORRECTION CRITIQUE: Essayer de parser JSON si Content-Type est application/json
      // même si content-length n'est pas présent (certains serveurs ne l'envoient pas)
      if (shouldTryParseJson) {
        try {
          data = await response.json();
          // ✅ DEBUG: Log la réponse JSON parsée pour /auth/login
          if (endpoint === '/auth/login') {
            console.log(`[Mobile API] ✅ JSON parsé avec succès:`, JSON.stringify(data, null, 2));
            console.log(`[Mobile API] ✅ data.token existe?:`, !!data?.token);
            console.log(`[Mobile API] ✅ data.tokens_balance:`, data?.tokens_balance);
          }
        } catch (jsonParseError) {
          // Si le parsing JSON échoue, essayer de lire comme texte
          console.error(`[Mobile API] ⚠️ Erreur parsing JSON, essai texte:`, jsonParseError);
          const textData = await responseClone.text();
          if (endpoint === '/auth/login') {
            console.log(`[Mobile API] ⚠️ Réponse texte:`, textData);
          }
          data = { raw: textData };
        }
      } else if (hasBody) {
        const textData = await response.text();
        data = { raw: textData };
        if (endpoint === '/auth/login') {
          console.log(`[Mobile API] ⚠️ Réponse non-JSON:`, textData);
        }
      } else {
        // ✅ DERNIER RECOURS: Essayer quand même de parser si Content-Type est JSON
        // même sans content-length (certains serveurs ne l'envoient pas)
        if (isJson && response.ok) {
          try {
            data = await response.json();
            if (endpoint === '/auth/login') {
              console.log(`[Mobile API] ✅ JSON parsé (sans content-length):`, JSON.stringify(data, null, 2));
            }
          } catch (e) {
            data = {};
            if (endpoint === '/auth/login') {
              console.log(`[Mobile API] ⚠️ Réponse sans body (tentative échouée)`);
            }
          }
        } else {
          data = {};
          if (endpoint === '/auth/login') {
            console.log(`[Mobile API] ⚠️ Réponse sans body`);
          }
        }
      }
    } catch (jsonError) {
      console.error(`[Mobile API] Erreur parsing JSON pour ${endpoint}:`, jsonError);
      console.error(`[Mobile API] Response status: ${response.status}`);
      console.error(`[Mobile API] Response headers:`, Object.fromEntries(response.headers.entries()));

      // ✅ CORRIGÉ: Utiliser la réponse clonée pour lire le texte
      try {
        const textData = await responseClone.text();
        console.error(`[Mobile API] Response text:`, textData);
        data = { error: 'Invalid JSON response', raw: textData };
      } catch (textError) {
        console.error(`[Mobile API] Impossible de lire la réponse:`, textError);
        data = { error: 'Unable to read response' };
      }
    }

    if (!response.ok) {
      // ✅ DEBUG: Log pour /auth/login même en cas d'erreur
      if (endpoint === '/auth/login') {
        console.error(`[Mobile API] ❌ Response not OK:`, {
          status: response.status,
          statusText: response.statusText,
          data: data,
        });
      }

      // ✅ NOUVEAU 2025-12-11: Gérer les erreurs d'authentification (401) pour éviter les requêtes en boucle
      if (response.status === 401) {
        console.warn(`[Mobile API] ⚠️ Token invalide ou expiré pour ${endpoint}, suppression du token`);
        // Supprimer le token invalide pour éviter les requêtes en boucle
        try {
          await removeAuthToken();
        } catch (error) {
          console.error('[Mobile API] Erreur suppression token:', error);
        }
        // Ne pas faire de requête de rafraîchissement automatique ici pour éviter les boucles infinies
        // L'utilisateur devra se reconnecter manuellement
      }

      // ✅ CORRIGÉ 2025-12-24: Améliorer l'extraction du message d'erreur
      // Le backend peut retourner error, message, ou les deux
      let errorMessage = data?.message || data?.error;

      // ✅ Si c'est une erreur 401 et qu'on n'a pas de message, utiliser un message par défaut
      if (response.status === 401 && !errorMessage) {
        errorMessage = 'Identifiants incorrects';
      }

      // ✅ Dernier recours : message générique avec le status
      if (!errorMessage) {
        errorMessage = `Erreur ${response.status}`;
      }

      return {
        success: false,
        error: errorMessage,
        data: data,
        status: response.status, // ✅ NOUVEAU: Inclure le status pour gestion spécifique
      };
    }

    // ✅ DEBUG: Log la structure finale pour /auth/login
    if (endpoint === '/auth/login') {
      console.log(`[Mobile API] ✅ Structure finale retournée:`, {
        success: true,
        data: data,
        'data.token': data?.token,
        'data.tokens_balance': data?.tokens_balance,
        'typeof data': typeof data,
        'data keys': data ? Object.keys(data) : [],
      });
    }

    return {
      success: true,
      data: data,
    };
  } catch (error: any) {
    console.error(`[Mobile API] Erreur pour ${endpoint}:`, error);

    // ✅ AMÉLIORÉ: Gérer les erreurs de timeout (AbortError)
    if (error.name === 'AbortError' || error.message === 'Aborted') {
      console.error(`[Mobile API] Timeout pour ${endpoint}`);

      // ✅ NOUVEAU: Message spécifique pour création de service avec payload volumineux
      let errorMessage = 'La requête a expiré. Vérifiez votre connexion internet.';
      if (endpoint.includes('/services/create')) {
        errorMessage = 'La création du service a pris trop de temps. Cela peut être dû à un grand nombre de médias.\n\nConseils :\n- Réduisez le nombre d\'images par produit\n- Raccourcissez les vidéos\n- Vérifiez votre connexion internet';
      } else if (endpoint.includes('/services/') && endpoint.includes('/products')) {
        errorMessage = 'L\'ajout du produit a pris trop de temps (plus de 3 minutes). Cela peut être dû à :\n\n• Un grand nombre de médias\n• Des variants complexes\n• Une connexion internet lente\n• Un serveur temporairement surchargé\n• Des opérations backend lourdes\n\n⚠️ Le produit peut avoir été créé malgré l\'erreur. Vérifiez votre liste de produits avant de réessayer.';
      }

      return {
        success: false,
        error: errorMessage,
        data: null,
        code: 'TIMEOUT',
      };
    }

    // ✅ AMÉLIORÉ: Gérer les erreurs de réseau (plus de patterns)
    const networkErrorPatterns = [
      'Failed to fetch',
      'NetworkError',
      'Network request failed',
      'TypeError: Network request failed',
      'NetworkError when attempting to fetch',
      'ERR_INTERNET_DISCONNECTED',
      'ERR_NETWORK_CHANGED',
      'ERR_CONNECTION_REFUSED',
      'ERR_CONNECTION_TIMED_OUT',
      'ERR_NAME_NOT_RESOLVED',
    ];

    const isNetworkError = networkErrorPatterns.some(pattern =>
      error.message?.includes(pattern) ||
      error.toString().includes(pattern) ||
      error.code?.includes(pattern) ||
      (error.name && networkErrorPatterns.some(p => error.name.includes(p)))
    );

    if (isNetworkError) {
      console.error(`[Mobile API] Erreur réseau pour ${endpoint}:`, error.message || error.toString());
      console.error(`[Mobile API] Détails erreur:`, {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 200),
      });

      // ✅ NOUVEAU: Message spécifique pour création de service
      let errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
      if (endpoint.includes('/services/create')) {
        errorMessage = 'Impossible d\'envoyer la requête au serveur.\n\nCauses possibles :\n- Connexion internet instable\n- Payload trop volumineux\n- Serveur temporairement indisponible (cold start)\n\nConseils :\n- Vérifiez votre connexion\n- Réduisez le nombre de médias\n- Réessayez dans quelques instants (le serveur peut être en veille)';
      }

      return {
        success: false,
        error: errorMessage,
        data: null,
        code: 'NETWORK_ERROR',
        status: 0, // Status 0 indique une erreur réseau
      };
    }

    // ✅ AMÉLIORÉ: Gérer les erreurs avec codes spécifiques
    const apiError = errorHandler.handleApiError(error, 'API Call');
    return {
      success: false,
      error: apiError.message, // Message utilisateur au lieu du message technique
      data: null,
      status: apiError.status,
      code: apiError.code, // ✅ NOUVEAU: Code d'erreur pour gestion spécifique
    };
  }
};

// ✅ NOUVEAU: Fonction principale avec retry par défaut (peut être désactivé ou configuré)
export const apiCall = async <T>(
  endpoint: string,
  options: RequestInit = {},
  useRetry: boolean | RetryConfig = true
): Promise<ApiResponse<T>> => {
  if (useRetry === false) {
    return apiCallInternal<T>(endpoint, options);
  }

  // Si useRetry est un objet RetryConfig, l'utiliser
  if (typeof useRetry === 'object') {
    return apiCallWithRetry<T>(endpoint, options, useRetry);
  }

  // Sinon, utiliser la configuration par défaut
  return apiCallWithRetry<T>(endpoint, options);
};

// ===== AUTHENTIFICATION =====

export const authApi = {
  // Connexion
  login: async (email: string, password: string) => {
    console.log('[authApi.login] Début de la connexion...');
    const response = await apiCall<{ token: string; tokens_balance: number }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    console.log('[authApi.login] Réponse complète reçue:', JSON.stringify(response, null, 2));
    console.log('[authApi.login] response.success:', response.success);
    console.log('[authApi.login] response.data:', response.data);
    console.log('[authApi.login] response.data?.token:', response.data?.token);
    console.log('[authApi.login] response.error:', response.error);

    if (response.data?.token) {
      console.log('[authApi.login] ✅ Token trouvé, sauvegarde...');
      await saveAuthToken(response.data.token);
      if (response.data.tokens_balance !== undefined) {
        await SafeStorage.setItem('tokens_balance', response.data.tokens_balance.toString());
      }
    } else {
      console.error('[authApi.login] ❌ Token non trouvé dans response.data');
      console.error('[authApi.login] Structure de response:', {
        success: response.success,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        data: response.data,
      });
    }

    return response;
  },

  // Inscription (identique au frontend)
  register: async (userData: {
    name?: string;
    nom?: string;
    prenom?: string;
    email: string;
    password: string;
    phone?: string;
    // ✅ NOUVEAU: Champs pour inscription partenaire
    is_partner?: boolean;
    partner_type?: string;
    partner_name?: string;
    partner_phone?: string;
    partner_address?: string;
    partner_city?: string;
    partner_country?: string;
  }) => {
    // Payload identique au frontend
    const payload: any = {
      nom: userData.nom || userData.name,
      prenom: userData.prenom || userData.name,
      name: userData.name || userData.nom,
      email: userData.email,
      password: userData.password,
      lang: 'fr',
    };

    // ✅ NOUVEAU 2026-02-25: Ajouter le téléphone si fourni
    if (userData.phone) {
      payload.phone = userData.phone;
      payload.phone_country = (userData as any).phone_country || 'CM';
    }

    // ✅ NOUVEAU: Ajouter les champs partenaire si présents
    if (userData.is_partner) {
      payload.is_partner = true;
      payload.partner_type = userData.partner_type;
      payload.partner_name = userData.partner_name;
      payload.partner_phone = userData.partner_phone;
      payload.partner_address = userData.partner_address;
      payload.partner_city = userData.partner_city;
      payload.partner_country = userData.partner_country;
    }

    const response = await apiCall<{ success?: boolean; token?: string; tokens_balance?: number; message?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    console.log('[API] Réponse inscription:', response);

    // Si le backend retourne directement un token (comme le frontend), le traiter
    if (response.data?.token) {
      await saveAuthToken(response.data.token);
      if (response.data.tokens_balance !== undefined) {
        await SafeStorage.setItem('tokens_balance', response.data.tokens_balance.toString());
      }
      return { success: true, data: response.data };
    }

    return response;
  },

  // Déconnexion
  logout: async () => {
    await removeAuthToken();
    await SafeStorage.removeItem('tokens_balance');
  },

  // Vérifier le token et récupérer les infos utilisateur
  verifyToken: async () => {
    return apiCall('/api/user/me');
  },
};

// ===== SERVICES =====

export const servicesApi = {
  // Recherche directe de services
  searchDirect: async (searchData: any) => {
    return apiCall('/api/search/direct', {
      method: 'POST',
      body: JSON.stringify(searchData),
    });
  },

  // Créer un service
  createService: async (serviceData: any) => {
    // ✅ CORRECTION : Le backend attend { user_id, data }
    // Extraire user_id si présent dans serviceData, sinon le récupérer du token
    let userId = serviceData.user_id;

    if (!userId) {
      // Récupérer user_id depuis le token
      const token = await getAuthToken();
      if (token) {
        try {
          const tokenData = JSON.parse(atob(token.split('.')[1]));
          userId = tokenData.sub || tokenData.user_id || tokenData.id;
        } catch (e) {
          console.error('[API] Impossible de récupérer user_id du token');
        }
      }
    }

    // Retirer user_id de serviceData s'il existe pour éviter de le dupliquer
    const { user_id, ...dataOnly } = serviceData;

    // ✅ NOUVEAU: Configuration de retry spécifique pour création de service
    // Plus de retries (5 au lieu de 3) car le serveur Render peut être en veille (cold start)
    const retryConfig: RetryConfig = {
      maxRetries: 5, // ✅ AUGMENTÉ: 5 retries pour gérer les cold starts Render
      retryableStatuses: [408, 429, 500, 502, 503, 504],
      retryableErrors: ['Network request failed', 'Failed to fetch', 'AbortError', 'NETWORK_ERROR'],
    };

    // ✅ CORRECTION: Timeout de 180s automatique pour /services/create (déjà géré dans apiCallInternal)
    return apiCall('/api/services/create', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        data: dataOnly // ✅ Encapsuler les données dans 'data'
      })
    }, retryConfig); // ✅ Utiliser configuration de retry personnalisée
  },

  // Obtenir les services de l'utilisateur (prestataire)
  getUserServices: async () => {
    return apiCall('/api/prestataire/services');
  },

  // Obtenir un service par ID
  getServiceById: async (serviceId: string) => {
    return apiCall(`/api/services/${serviceId}`);
  },

  // Mettre à jour un service
  updateService: async (serviceId: string, serviceData: any) => {
    return apiCall(`/api/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData),
    });
  },

  // Supprimer un service
  deleteService: async (serviceId: string) => {
    return apiCall(`/api/services/${serviceId}/delete`, {
      method: 'DELETE',
    });
  },

  // Obtenir les services avec lesquels l'utilisateur a interagi
  getInteractedServices: async () => {
    return apiCall('/api/services/interacted');
  },

  // Obtenir les services d'un prestataire
  getPrestataireServices: async (prestataireId: string) => {
    return apiCall(`/api/services/prestataire/${prestataireId}`);
  },
};

// ===== DELIVERY & SHOPPING =====

interface WalletBalanceResponse {
  balance: number;
  currency: string;
  pending?: number;
  updated_at?: string;
}

interface DeliveryListResponse {
  deliveries: any[];
}

export interface DeliveryLocationInput {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface DeliveryParcelInput {
  type_id?: number;
  weight_kg?: number;
  volume_cm3?: number;
  declared_value?: number;
  notes?: string;
  photos?: Record<string, unknown> | unknown[];
  constraints?: Record<string, unknown>;
}

export interface CreateDeliveryRequestPayload {
  preferred_vehicle_type?: string; // ✅ NOUVEAU : Type de véhicule préféré ('bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking')
  parcel: DeliveryParcelInput;
  pickup: DeliveryLocationInput;
  dropoff: DeliveryLocationInput;
  distance_meters?: number;
  estimated_duration_seconds?: number;
  metadata?: Record<string, unknown>;
  initial_event_payload?: Record<string, unknown>;
  recipient?: DeliveryRecipientPayload;
  // ✅ Aller-retour
  is_round_trip?: boolean;
  return_pickup?: DeliveryLocationInput;
  return_dropoff?: DeliveryLocationInput;
  round_trip_discount_percent?: number; // Réduction en % pour aller-retour (0-100)
  // ✅ Planification
  scheduled_delivery_at?: string; // ISO 8601 datetime (ex: "2025-02-01T14:30:00Z")
  matching_mode?: 'immediate' | 'scheduled'; // Matching immédiat ou à la date planifiée
}

export interface DropoffShareResponse {
  tracking_token: string;
  share_url?: string | null;
  dropoff_pending: boolean;
}

// ✅ Cache pour les supermarchés (mobile) - SafeStorage utilisé

interface CachedSupermarkets {
  supermarkets: any[];
  timestamp: number;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

const SUPERMARKETS_CACHE_KEY = 'yukpo_supermarkets_cache';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (lat: number, lng: number, radius: number): string => {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;
  return `${SUPERMARKETS_CACHE_KEY}_${roundedLat}_${roundedLng}_${radius}`;
};

const getCachedSupermarkets = async (lat: number, lng: number, radiusKm: number): Promise<any[] | null> => {
  try {
    const cacheKey = getCacheKey(lat, lng, radiusKm);
    const cached = await SafeStorage.getItem(cacheKey);
    if (!cached) return null;

    const data: CachedSupermarkets = JSON.parse(cached);
    const now = Date.now();

    if (now - data.timestamp > CACHE_DURATION_MS) {
      await SafeStorage.removeItem(cacheKey);
      return null;
    }

    const distance = Math.sqrt(
      Math.pow(data.latitude - lat, 2) + Math.pow(data.longitude - lng, 2)
    ) * 111;
    if (distance > 1) return null;

    return data.supermarkets;
  } catch (error) {
    console.warn('Erreur lecture cache supermarchés:', error);
    return null;
  }
};

const setCachedSupermarkets = async (lat: number, lng: number, radiusKm: number, supermarkets: any[]): Promise<void> => {
  try {
    const cacheKey = getCacheKey(lat, lng, radiusKm);
    const data: CachedSupermarkets = {
      supermarkets,
      timestamp: Date.now(),
      latitude: lat,
      longitude: lng,
      radiusKm,
    };
    await SafeStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (error) {
    console.warn('Erreur écriture cache supermarchés:', error);
  }
};

export const deliveryApi = {
  // ✅ NOUVEAU: Vérifier la disponibilité d'un produit
  checkProductAvailability: async (serviceId: number, productIndex: number) => {
    return apiCall<{
      success: boolean;
      availability: {
        is_available: boolean;
        reason?: string;
        available_days?: number[];
        is_immediately_available: boolean;
        preparation_time_minutes?: number;
      };
    }>(`/api/delivery/product-availability/${serviceId}/${productIndex}`);
  },
  // ✅ FIX 2026-03-05: API stats coursier (remplace le hardcode)
  getCourierStats: async () => {
    return apiCall('/api/delivery/courier/stats');
  },
  listActiveDeliveries: async () => {
    return apiCall<DeliveryListResponse>('/api/deliveries/active');
  },
  getDeliveryById: async (deliveryId: string) => {
    return apiCall(`/api/deliveries/${deliveryId}`);
  },
  createDeliveryRequest: async (payload: CreateDeliveryRequestPayload) => {
    const response = await apiCall<{ delivery?: any; id?: string; status?: string; metadata?: any; shopping_required?: boolean }>(`/api/delivery`, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        preferred_vehicle_type: payload.preferred_vehicle_type, // ✅ NOUVEAU : Transmettre le type de véhicule préféré
        metadata: payload.metadata ?? {},
        initial_event_payload: payload.initial_event_payload ?? {},
        parcel: {
          photos: payload.parcel.photos ?? [],
          constraints: payload.parcel.constraints ?? {},
          ...payload.parcel,
        },
      }),
    });

    // ✅ CORRIGÉ : Extraire les données de la réponse backend
    // Le backend retourne { "delivery": DeliverySummary }
    if (response.success && response.data) {
      const data = response.data as any;
      const delivery = data.delivery || data;
      return {
        success: true,
        data: {
          id: delivery.id,
          status: delivery.status,
          kind: delivery.metadata?.kind || (delivery.shopping_required ? 'shopping' : 'parcel'),
        },
      };
    }

    return response;
  },
  // ✅ Nouveau : Récupérer les supermarchés avec cache
  listSupermarkets: async (latitude: number, longitude: number, radiusKm: number = 10) => {
    try {
      // Vérifier le cache
      const cached = await getCachedSupermarkets(latitude, longitude, radiusKm);
      if (cached) {
        console.log('[DeliveryApi] ✅ Supermarchés récupérés depuis le cache');
        return { supermarkets: cached, total: cached.length };
      }

      // Appeler l'API
      const response = await apiCall(`/api/services/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radiusKm * 1000}&limit=20`);
      const data = (response.data || response) as { services?: any[] };

      // Filtrer les supermarchés
      const keywords = ['supermarche', 'supermarket', 'carrefour', 'casino', 'super u', 'auchan', 'leclerc', 'intermarche', 'monoprix', 'franprix', 'magasin', 'epicerie', 'hypermarché'];

      const supermarkets = ((data?.services || []) as any[])
        .filter((service: any) => {
          const category = (service.category || '').toLowerCase();
          const name = (service.name || '').toLowerCase();
          const description = (service.description || '').toLowerCase();
          return keywords.some(keyword =>
            category.includes(keyword) || name.includes(keyword) || description.includes(keyword)
          );
        })
        .map((service: any) => ({
          id: service.id,
          name: service.name,
          address: service.address || 'Adresse non disponible',
          latitude: service.latitude || 0,
          longitude: service.longitude || 0,
          distance_km: service.distance ? Math.round(service.distance / 1000 * 10) / 10 : undefined,
          phone: service.phone,
          website: service.website,
        }));

      // Mettre en cache
      await setCachedSupermarkets(latitude, longitude, radiusKm, supermarkets);

      return { supermarkets, total: supermarkets.length };
    } catch (error) {
      console.error('Erreur récupération supermarchés:', error);
      return { supermarkets: [], total: 0 };
    }
  },
  // ✅ NOUVEAU: Lister les coursiers disponibles avec filtres
  listAvailableCouriers: async (params: {
    pickup_latitude?: number;
    pickup_longitude?: number;
    delivery_latitude?: number;
    delivery_longitude?: number;
    max_distance_km?: number;
    transport_type?: string;
    specialization?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params.pickup_latitude) queryParams.append('pickup_latitude', params.pickup_latitude.toString());
    if (params.pickup_longitude) queryParams.append('pickup_longitude', params.pickup_longitude.toString());
    if (params.delivery_latitude) queryParams.append('delivery_latitude', params.delivery_latitude.toString());
    if (params.delivery_longitude) queryParams.append('delivery_longitude', params.delivery_longitude.toString());
    if (params.max_distance_km) queryParams.append('max_distance_km', params.max_distance_km.toString());
    if (params.transport_type) queryParams.append('transport_type', params.transport_type);
    if (params.specialization) queryParams.append('specialization', params.specialization);

    return apiCall(`/api/deliveries/couriers/available?${queryParams.toString()}`);
  },
  getRecipientUpdates: async (deliveryId: string) => {
    return apiCall(`/api/deliveries/${deliveryId}/recipient/updates`);
  },
  assignRecipient: async (deliveryId: string, payload: DeliveryRecipientPayload) => {
    return apiCall(`/api/deliveries/${deliveryId}/recipient`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU : Récupérer les instructions de navigation pour le coursier
  getCourierNavigation: async (deliveryId: string, courierLat?: number, courierLng?: number) => {
    const params = new URLSearchParams();
    if (courierLat !== undefined) params.append('courier_lat', courierLat.toString());
    if (courierLng !== undefined) params.append('courier_lng', courierLng.toString());
    const queryString = params.toString();
    const url = `/api/delivery/${deliveryId}/navigation${queryString ? `?${queryString}` : ''}`;
    return apiCall(url);
  },
  // ✅ NOUVEAU : Vérifier le statut coursier de l'utilisateur
  getMyCourierStatus: async () => {
    return apiCall('/api/courier/me');
  },
  // ✅ NOUVEAU : Soumettre une candidature de coursier
  submitCourierApplication: async (payload: {
    profile_data: Record<string, unknown>;
    documents: Record<string, unknown>;
    submitted: boolean;
    partner_id?: number; // ✅ NOUVEAU 2026-01-22: ID du partenaire de livraison
  }) => {
    return apiCall('/api/courier/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateRecipientLocation: async (deliveryId: string, payload: DeliveryLocationUpdatePayload) => {
    return apiCall(`/api/deliveries/${deliveryId}/recipient/location`, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });
  },
  // ✅ NOUVEAU : Signaler une difficulté du coursier
  reportCourierDifficulty: async (
    deliveryId: string,
    difficultyType: 'breakdown' | 'illness',
    relayLocation?: { latitude: number; longitude: number; address?: string },
    notes?: string
  ) => {
    return apiCall(`/api/delivery/${deliveryId}/report-difficulty`, {
      method: 'POST',
      body: JSON.stringify({
        difficulty_type: difficultyType,
        relay_location: relayLocation,
        notes: notes,
      }),
    });
  },
  // ✅ NOUVEAU : Accepter une course
  acceptDelivery: async (deliveryId: string) => {
    return apiCall(`/api/delivery/${deliveryId}/accept`, {
      method: 'POST',
    });
  },
  updateStatus: async (deliveryId: string, status: string, metadata?: Record<string, any>) => {
    return apiCall(`/api/deliveries/${deliveryId}/status`, {
      method: 'POST',
      body: JSON.stringify({
        status,
        metadata,
      }),
    });
  },
  cancelDelivery: async (deliveryId: string, reason?: string) => {
    return apiCall(`/api/deliveries/${deliveryId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        reason,
      }),
    });
  },
  rateDelivery: async (deliveryId: string, rating: number, feedback?: string) => {
    return apiCall(`/api/deliveries/${deliveryId}/rating`, {
      method: 'POST',
      body: JSON.stringify({
        rating,
        feedback,
      }),
    });
  },
  shareDropoffLink: async (deliveryId: string) => {
    return apiCall<DropoffShareResponse>(`/api/delivery/${deliveryId}/share-dropoff`, {
      method: 'POST',
    });
  },
  // ✅ Phase 9 - Amélioration 28 : Assigner un coursier manuellement
  assignCourier: async (deliveryId: string, courierId: string) => {
    return apiCall(`/api/delivery/${deliveryId}/assign-courier`, {
      method: 'POST',
      body: JSON.stringify({ courier_id: courierId }),
    });
  },
  // ✅ NOUVEAU : Vérification d'identité du coursier
  verifyCourier: async (deliveryId: string, verificationCode: string, verificationMethod?: string) => {
    return apiCall(`/api/delivery/${deliveryId}/verify-courier`, {
      method: 'POST',
      body: JSON.stringify({
        verification_code: verificationCode,
        verification_method: verificationMethod || 'pin_code',
      }),
    });
  },
  // ✅ NOUVEAU : Le coursier récupère son propre code de vérification + liste produits
  getMyVerificationCode: async (deliveryId: string) => {
    return apiCall(`/api/delivery/${deliveryId}/my-verification-code`);
  },
  // ✅ NOUVEAU : Le prestataire récupère le code de vérification de la livraison
  getVerificationCode: async (deliveryId: string) => {
    return apiCall(`/api/delivery/${deliveryId}/verification-code`);
  },
  // ✅ NOUVEAU : Récupérer la configuration de livraison d'un produit
  getProductDeliveryConfig: async (serviceId: number, productIndex: number) => {
    return apiCall(`/api/delivery/product-config/${serviceId}/${productIndex}`);
  },
  // ✅ NOUVEAU : Créer une commande client directe avec matching intelligent automatique
  createClientOrder: async (payload: {
    service_id: number;
    product_index?: number;
    dropoff?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    notes?: string;
    metadata?: any;
  }) => {
    return apiCall('/api/delivery/client-order', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU: Lister les configurations de livraison d'un service
  listProductDeliveryConfigs: async (serviceId: number) => {
    return apiCall<{
      success: boolean;
      products: Array<{ index: number, name: string, is_configured: boolean }>;
    }>(`/api/delivery/product-config/list/${serviceId}`);
  },
  // ✅ Phase 9 - Amélioration 32 : Gestion des lieux de stock
  listStorageLocations: async () => {
    return apiCall('/api/delivery/storage-locations');
  },
  getStorageLocation: async (id: number) => {
    return apiCall(`/api/delivery/storage-locations/${id}`);
  },
  createStorageLocation: async (payload: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    zone_id?: string | null; // ✅ Phase 9 - Amélioration : Zone géographique
    is_active?: boolean;
  }) => {
    return apiCall('/api/delivery/storage-locations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateStorageLocation: async (id: number, payload: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    zone_id?: string | null; // ✅ Phase 9 - Amélioration : Zone géographique
    is_active?: boolean;
  }) => {
    return apiCall(`/api/delivery/storage-locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  deleteStorageLocation: async (id: number) => {
    return apiCall(`/api/delivery/storage-locations/${id}`, {
      method: 'DELETE',
    });
  },
  // ✅ Phase 9 - Amélioration : Lister les zones de livraison disponibles
  listDeliveryZones: async (): Promise<Array<{ id: string; name: string; description?: string | null; is_active: boolean }>> => {
    const response = await apiCall('/api/delivery/zones');
    // La réponse peut être directement un tableau ou dans response.data
    if (response && typeof response === 'object') {
      if (response.success && response.data) {
        return Array.isArray(response.data) ? response.data : (response.data as any)?.zones || [];
      }
      if (Array.isArray(response)) {
        return response;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
    }
    return [];
  },
  // ✅ NOUVEAU 2025-01-27: Uploader un média (image, audio, vidéo) pour le chat vers S3/Wasabi
  uploadChatMedia: async (fileData: string | { uri: string; type: string; name: string }): Promise<ApiResponse<{ url: string; storage_path: string }>> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, error: 'Non authentifié' };
      }

      // Créer FormData (React Native compatible)
      const formData = new FormData();

      // Si c'est une data URI (base64), on doit la convertir
      if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        // Extraire les données base64
        const base64Data = fileData.split(',')[1];
        const mimeType = fileData.split(';')[0].split(':')[1];
        const fileName = `file_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;

        formData.append('file', {
          uri: fileData,
          type: mimeType,
          name: fileName,
        } as any);
      } else if (typeof fileData === 'object' && fileData.uri) {
        // Si c'est un objet avec URI (fichier local)
        formData.append('file', {
          uri: fileData.uri,
          type: fileData.type || 'application/octet-stream',
          name: fileData.name || `file_${Date.now()}`,
        } as any);
      } else {
        // Fallback: traiter comme string URI
        formData.append('file', {
          uri: fileData as string,
          type: 'application/octet-stream',
          name: `file_${Date.now()}`,
        } as any);
      }

      const uploadResponse = await fetch(`${API_BASE_URL}/api/chat/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await uploadResponse.json();
      return {
        success: uploadResponse.ok && data.success,
        data: data.files?.[0] || data,
        error: data.error || (!uploadResponse.ok ? `Erreur ${uploadResponse.status}` : undefined),
      };
    } catch (error: any) {
      console.error('[API] Erreur upload média chat:', error);
      return {
        success: false,
        error: error?.message || 'Erreur upload média',
      };
    }
  },
  // ✅ Phase 9 - Amélioration : Gestion des médias de preuve de livraison
  listProofMedia: async (deliveryId: string) => {
    return apiCall(`/api/delivery/${deliveryId}/proof-media`);
  },

  uploadProofMedia: async (deliveryId: string, payload: {
    media_type: 'image' | 'video';
    media_url: string;
    proof_type: 'pickup' | 'delivery';
    metadata?: Record<string, unknown>;
  }) => {
    return apiCall(`/api/delivery/${deliveryId}/proof-media`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  deleteProofMedia: async (deliveryId: string, mediaId: number) => {
    return apiCall(`/api/delivery/${deliveryId}/proof-media/${mediaId}`, {
      method: 'DELETE',
    });
  },
  // ✅ Phase 9 - Amélioration : Gestion des zones de livraison des produits
  getProductZones: async (serviceId: number, productIndex: number) => {
    return apiCall(`/api/products/${serviceId}/${productIndex}/zones`);
  },
  saveProductZones: async (serviceId: number, productIndex: number, zoneIds: string[]) => {
    return apiCall(`/api/products/${serviceId}/${productIndex}/zones`, {
      method: 'POST',
      body: JSON.stringify({ zone_ids: zoneIds }),
    });
  },
  getCourierHistory: async (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    const qs = query.toString();
    return apiCall(`/api/delivery/courier/history${qs ? `?${qs}` : ''}`);
  },
};

export const shoppingApi = {
  estimateOrder: async (payload: ShoppingOrderPayload) => {
    return apiCall('/api/shopping/orders/estimate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateOrderItem: async (
    orderId: string,
    itemId: string,
    payload: {
      actual_total?: number;
      actual_price?: number;
      note?: string;
      is_substitution?: boolean;
      status?: string;
      rejection_reason?: string; // ✅ Phase 9 - Amélioration : Raison de refus
    }
  ) => {
    return apiCall(`/api/shopping/orders/${orderId}/items/${itemId}`, {
      method: 'POST', // Le backend utilise POST, pas PATCH
      body: JSON.stringify(payload),
    });
  },
  // ✅ Phase 9 - Amélioration : Rejeter un produit avec raison
  rejectItem: async (orderId: string, itemId: string, reason: string) => {
    return apiCall(`/api/shopping/orders/${orderId}/items/${itemId}`, {
      method: 'POST',
      body: JSON.stringify({
        status: 'rejected',
        rejection_reason: reason,
      }),
    });
  },
  markShoppingStatus: async (
    orderId: string,
    payload: {
      status: string;
      note?: string;
    }
  ) => {
    return apiCall(`/api/shopping/orders/${orderId}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  createOrder: async (payload: ShoppingOrderPayload) => {
    return apiCall('/api/shopping/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  getOrderById: async (orderId: string) => {
    return apiCall(`/api/shopping/orders/${orderId}`);
  },
  checkoutOrder: async (
    orderId: string,
    payload: {
      actual_total: number;
      currency: string;
      receipt_url?: string;
      purchased_items?: Array<{
        id: string;
        actualPrice?: number;
        actualTotal?: number;
        note?: string;
        isSubstitution?: boolean;
      }>;
    }
  ) => {
    return apiCall(`/api/shopping/orders/${orderId}/checkout`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const walletApi = {
  getBalance: async () => {
    return apiCall<WalletBalanceResponse>('/api/wallet/balance');
  },
  debitForDelivery: async (deliveryId: string, amount: number, currency: string) => {
    return apiCall(`/api/wallet/debit`, {
      method: 'POST',
      body: JSON.stringify({
        delivery_id: deliveryId,
        amount,
        currency,
      }),
    });
  },
  refundDelivery: async (deliveryId: string, amount: number, currency: string, reason?: string) => {
    return apiCall(`/api/wallet/refund`, {
      method: 'POST',
      body: JSON.stringify({
        delivery_id: deliveryId,
        amount,
        currency,
        reason,
      }),
    });
  },
  getFinancialSummary: async () => {
    return apiCall('/api/wallet/financial');
  },
  withdraw: async (payload: { amount: number; payment_method: string; phone_number: string }) => {
    return apiCall('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  getWithdrawalHistory: async () => {
    return apiCall('/api/wallet/withdrawals');
  },
};

// ===== MEDIA =====

export const mediaApi = {
  getServiceMediaDetailed: async (serviceId: string | number) => {
    return apiCall(`/api/services/${serviceId}/media`);
  },
  getProductMedia: async (serviceId: string | number, productIndex: string | number) => {
    return apiCall(`/api/media/product/${serviceId}/${productIndex}`);
  },
  generateProductVideo: async (
    serviceId: string | number,
    productIndex: string | number,
    payload: Record<string, any>
  ) => {
    return apiCall(`/api/media/product/${serviceId}/${productIndex}/generate-video`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  trackMediaView: async (mediaId: number | undefined | null, payload: { channel?: string; session_id?: string; metadata?: any }) => {
    // ✅ CORRECTION 2025-12-01: Valider mediaId avant l'appel API pour éviter /api/media/undefined/track-view
    if (!mediaId || mediaId === undefined || mediaId === null || isNaN(Number(mediaId))) {
      console.warn('[API] trackMediaView: mediaId invalide, skip tracking', { mediaId });
      return { success: false, error: 'mediaId invalide' };
    }

    return apiCall(`/api/media/${mediaId}/track-view`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  trackMediaShare: async (mediaId: number | undefined | null, payload: { channel?: string; session_id?: string; metadata?: any }) => {
    // ✅ CORRECTION 2025-12-01: Valider mediaId avant l'appel API pour éviter /api/media/undefined/track-share
    if (!mediaId || mediaId === undefined || mediaId === null || isNaN(Number(mediaId))) {
      console.warn('[API] trackMediaShare: mediaId invalide, skip tracking', { mediaId });
      return { success: false, error: 'mediaId invalide' };
    }

    return apiCall(`/api/media/${mediaId}/track-share`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateMediaDistribution: async (
    mediaId: number,
    target: string,
    payload: { status: string; metadata?: any }
  ) => {
    return apiCall(`/api/media/${mediaId}/distribution/${target}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  uploadServiceAudio: async (
    serviceId: string | number,
    file: { uri: string; name?: string; type?: string }
  ): Promise<UploadedMediaItem | null> => {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('audio', {
      uri: file.uri,
      name: file.name || `audio_${Date.now()}.mp3`,
      type: file.type || 'audio/mpeg',
    } as any);

    const response = await fetch(`${API_BASE_URL}/api/media/${serviceId}/upload`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Échec de l’import audio');
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as UploadedMediaItem;
    }
    return null;
  },
  getAudioLibrary: async () => {
    return apiCall('/api/audio-library');
  },
  attachAudioLoop: async (loopId: string, serviceId: number) => {
    return apiCall(`/api/audio-library/${loopId}/attach/${serviceId}`, {
      method: 'POST',
    });
  },
  getVoiceProfiles: async () => {
    return apiCall('/api/audio-library/voice-profiles');
  },
  createVoiceProfile: async (payload: CreateVoiceProfilePayload) => {
    return apiCall('/api/audio-library/voice-profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  deleteVoiceProfile: async (profileId: number) => {
    return apiCall(`/api/audio-library/voice-profiles/${profileId}`, {
      method: 'DELETE',
    });
  },
  getVideoJobStatus: async (jobId: string) => {
    return apiCall<VideoJobStatus>(`/api/media/jobs/${jobId}`);
  },
  // ✅ NOUVEAU: Méthodes pour la génération de vidéos IA
  generateVideoBrief: async (payload: any) => {
    return apiCall('/api/media/generate-video-brief', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  generateVideoStyle: async (payload: any) => {
    return apiCall('/api/media/generate-video-style', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  generateDistributionPlan: async (payload: any) => {
    return apiCall('/api/media/generate-distribution-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU: Génération de timeline de montage vidéo
  generateVideoTimeline: async (payload: any) => {
    return apiCall('/api/media/generate-video-timeline', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  analyzeMedia: async (payload: any) => {
    return apiCall('/api/media/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ===== IA =====

export const iaApi = {
  // Chat avec l'IA
  chat: async (message: string) => {
    return apiCall('/api/ia/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  // Créer un service avec l'IA (vectorisation)
  createServiceWithIA: async (serviceData: any) => {
    return apiCall('/api/services/vectorize', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  },

  // Créer un service avec l'IA (génération de formulaire)
  generateServiceForm: async (serviceData: any) => {
    return apiCall('/api/ia/creation-service', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  },

  // Générer des suggestions de service
  generateServiceSuggestions: async (prompt: string) => {
    return apiCall('/api/ia/suggestions', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  // Créer un brouillon de service
  createServiceDraft: async (donnees: any) => {
    return apiCall('/api/services/draft', {
      method: 'POST',
      body: JSON.stringify(donnees),
    });
  },

  // Récupérer les médias d'un service
  getServiceMedia: async (serviceId: string | number) => {
    return apiCall(`/api/services/${serviceId}/media`);
  },

  // Récupérer les statistiques d'un service
  getServiceStats: async (serviceId: string | number) => {
    return apiCall(`/api/services/${serviceId}/stats`);
  },

  // Suggérer des mots-clés
  suggestKeywords: async (text: string) => {
    return apiCall('/api/ia/keywords', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  // Transcrire de l'audio
  transcribeAudio: async (audioData: string) => {
    return apiCall('/api/ia/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audio: audioData }),
    });
  },
  generateVideoBrief: async (payload: {
    product_name: string;
    description?: string;
    price?: string;
    promotion?: string;
    highlights?: string[];
    target_audience?: string;
    tone?: string;
    lang?: string;
    variant_count?: number;
  }) => {
    return apiCall('/api/ia/video-brief', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  estimateVideoCost: async (
    serviceId: string | number,
    productIndex: number,
    payload: VideoGenerationPayload,
  ) => {
    return apiCall<{ success: boolean; data: VideoCostEstimation }>(
      `/api/media/product/${serviceId}/${productIndex}/estimate-video`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  generateImmersiveVideo: async (
    serviceId: string | number,
    productIndex: number,
    payload: VideoGenerationPayload,
  ) => {
    return apiCall<StartVideoJobResponse>(
      `/api/media/product/${serviceId}/${productIndex}/generate-video`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  generateVideoStyle: async (payload: {
    channel: string;
    product_type?: string;
    tone?: string;
    promotion?: string;
    highlights?: string[];
    lang?: string;
  }) => {
    return apiCall('/api/ia/video-style', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  analyzeMedia: async (payload: {
    product_name: string;
    media_tags?: string[];
    description?: string;
    lang?: string;
  }) => {
    return apiCall('/api/ia/media-analysis', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  generateDistributionPlan: async (payload: {
    product_name: string;
    channels?: string[];
    target_audience?: string;
    marketing_angle?: string;
    lang?: string;
  }) => {
    return apiCall('/api/ia/distribution-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  getVideoAnalyticsOverview: async (days: number = 7) => {
    return apiCall('/api/media/analytics/overview?days=' + days);
  },
  // ✅ NOUVEAU: Auto-cut intelligent
  autoCutVideo: async (payload: {
    video_url: string;
    video_id?: number;
    min_scene_duration?: number;
    max_scene_duration?: number;
    silence_threshold?: number;
    detect_highlights?: boolean;
    target_duration?: number;
  }) => {
    return apiCall('/api/ia/video/auto-cut', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU: Synchronisation audio-vidéo
  syncAudioVideo: async (payload: {
    video_url: string;
    audio_url?: string;
    music_track_id?: number;
    beat_detection?: boolean;
    auto_ducking?: boolean;
    sync_with_transitions?: boolean;
    target_bpm?: number;
    video_transitions?: number[];
  }) => {
    return apiCall('/api/ia/video/audio-sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU: Color grading automatique
  colorGradeMedia: async (payload: {
    media_url: string;
    media_id?: number;
    style_preset?: string;
    target_mood?: string;
    intensity?: number;
    maintain_skin_tones?: boolean;
  }) => {
    return apiCall('/api/ia/media/color-grade', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU: Génération automatique de sous-titres
  generateAutoCaptions: async (payload: {
    video_url: string;
    audio_url?: string;
    lang?: string;
    style?: string;
    position?: string;
    max_chars_per_line?: number;
    font_size?: number;
    background_opacity?: number;
  }) => {
    return apiCall('/api/ia/video/auto-captions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU: Génération de previews d'effets
  generateEffectPreview: async (payload: {
    effect_name: string;
    sample_media_url: string;
    duration?: number;
    quality?: string;
  }) => {
    return apiCall('/api/ia/effects/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU: Génération de variantes de timeline
  generateTimelineVariants: async (payload: any) => {
    return apiCall('/api/ia/video/timeline-variants', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU: Suggestions audio contextuelles
  getAudioSuggestions: async (payload: {
    product_name: string;
    product_type?: string;
    tone?: string;
    channel?: string;
    duration_seconds?: number;
    count?: number;
  }) => {
    return apiCall('/api/ia/audio/suggestions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // ✅ NOUVEAU: Génération de preview rapide
  generateQuickPreview: async (payload: {
    timeline: any;
    quality?: string;
    max_duration?: number;
  }) => {
    return apiCall('/api/ia/video/quick-preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ===== UTILISATEUR =====

export const userApi = {
  // Obtenir le profil utilisateur
  getUserProfile: async () => {
    return apiCall('/api/user/me');
  },

  // Mettre à jour le profil utilisateur
  updateUserProfile: async (profileData: any) => {
    return apiCall('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  // Obtenir le solde de tokens
  getTokensBalance: async () => {
    return apiCall('/api/users/balance');
  },

  // Recharger des tokens
  rechargeTokens: async (amount: number) => {
    return apiCall('/api/users/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  // Déduire du solde
  deductBalance: async (amount: number, reason: string) => {
    return apiCall('/api/users/deduct-balance', {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    });
  },

  // Obtenir le dashboard prestataire
  getDashboardPrestataire: async (period: string = '30d') => {
    return apiCall(`/api/dashboard/prestataire?period=${period}`);
  },
  getPreviousContacts: async () => {
    return apiCall('/api/user/previous-contacts');
  },
  saveContact: async (contact: any) => {
    return apiCall('/api/user/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  },
  getCreditHistory: async (userId: string, period: string = '30d') => {
    return apiCall(`/api/users/consumption-history?period=${period}`);
  },
  getPaymentsHistory: async (userId: string, period: string = '30d') => {
    return apiCall(`/api/users/payment-history?period=${period}`);
  },
  toggleServiceStatus: async (serviceId: number, isActive: boolean) => {
    return apiCall(`/api/services/${serviceId}/toggle-status`, {
      method: 'PATCH',
      body: JSON.stringify({ actif: isActive }),
    });
  },
  deleteService: async (serviceId: number) => {
    return apiCall(`/api/services/${serviceId}/delete`, {
      method: 'DELETE',
    });
  },
  updateServicePromotion: async (serviceId: number, promotionData: any) => {
    return apiCall(`/api/services/${serviceId}/promotion`, {
      method: 'PATCH',
      body: JSON.stringify(promotionData),
    });
  },

  // Obtenir les services de l'utilisateur (prestataire)
  getUserServices: async () => {
    return apiCall('/api/prestataire/services');
  },

  // Obtenir le budget utilisateur
  getUserBudget: async () => {
    return apiCall('/api/users/budget');
  },

  // Obtenir l'historique de consommation
  getConsumptionHistory: async (userId: string, period: string = 'month') => {
    return apiCall(`/api/user/credit/history/${userId}?period=${period}`);
  },

  // Gestion des favoris
  getUserFavorites: async (userId: string) => {
    return apiCall(`/api/users/${userId}/favorites`);
  },

  addFavorite: async (serviceId: string) => {
    return apiCall('/api/favorites', {
      method: 'POST',
      body: JSON.stringify({ service_id: serviceId }),
    });
  },

  removeFavorite: async (favoriteId: string) => {
    return apiCall(`/api/favorites/${favoriteId}`, {
      method: 'DELETE',
    });
  },
};

// ===== LOCALISATION =====

export const locationApi = {
  // Mettre à jour la position GPS - CORRIGÉ pour correspondre au backend
  updateLocation: async (latitude: number, longitude: number) => {
    return apiCall('/api/user/me/gps_location', {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude }),
    });
  },

  // Obtenir la position GPS - CORRIGÉ pour correspondre au backend
  getLocation: async () => {
    return apiCall('/api/user/me/gps_location');
  },
};

// ===== NOTIFICATIONS =====

export const notificationsApi = {
  // Obtenir l'historique des notifications
  getNotificationHistory: async () => {
    return apiCall('/api/notifications/history');
  },

  // Obtenir les notifications (alias pour compatibilité)
  getNotifications: async () => {
    return apiCall('/api/notifications/history');
  },

  // Marquer une notification comme lue
  markAsRead: async (notificationId: string) => {
    return apiCall(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },

  // Marquer toutes les notifications comme lues
  markAllAsRead: async () => {
    return apiCall('/api/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  // Supprimer une notification
  deleteNotification: async (notificationId: string) => {
    return apiCall(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  // Obtenir l'historique des chats
  getChatHistory: async (clientId: string, prestataireId: string) => {
    return apiCall(`/api/chat/history/${clientId}/${prestataireId}`);
  },

  // Envoyer un message audio
  sendAudioMessage: async (audioData: string, recipientId: string) => {
    return apiCall('/api/chat/audio', {
      method: 'POST',
      body: JSON.stringify({ audio: audioData, recipientId }),
    });
  },
};

export const analyticsApi = {
  getContentAnalytics: async (params?: {
    days?: number;
    limit?: number;
    contentType?: 'organic' | 'paid';
  }) => {
    const queryParts: string[] = [];
    if (params?.days !== undefined) {
      queryParts.push(`days=${encodeURIComponent(params.days)}`);
    }
    if (params?.limit !== undefined) {
      queryParts.push(`limit=${encodeURIComponent(params.limit)}`);
    }
    if (params?.contentType) {
      queryParts.push(`content_type=${encodeURIComponent(params.contentType)}`);
    }
    const queryString = queryParts.length ? `?${queryParts.join('&')}` : '';
    return apiCall<ContentAnalyticsApiResponse>(`/api/content/analytics${queryString}`, {
      method: 'GET',
    });
  },
  getVideoOverview: async (params?: { days?: number }) => {
    const queryParts: string[] = [];
    if (params?.days !== undefined) {
      queryParts.push(`days=${encodeURIComponent(params.days)}`);
    }
    const queryString = queryParts.length ? `?${queryParts.join('&')}` : '';
    return apiCall<VideoAnalyticsOverviewResponse>(`/api/media/analytics/overview${queryString}`, {
      method: 'GET',
    });
  },
};

// Gestion des commentaires produits (fil moderne)
export const commentsApi = {
  getProductComments: async (serviceId: number, params?: { limit?: number; cursor?: number | null; sort?: string; product_index?: number }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.cursor) queryParams.append('cursor', params.cursor.toString());
      if (params.sort) queryParams.append('sort', params.sort);
      // ✅ CORRIGÉ 2026-03-02: Filtrer les commentaires par produit spécifique
      if (params.product_index !== undefined && params.product_index !== null) {
        queryParams.append('product_index', params.product_index.toString());
      }
    }
    const qs = queryParams.toString();
    const url = qs ? `/api/services/${serviceId}/comments?${qs}` : `/api/services/${serviceId}/comments`;
    return apiCall(url);
  },
  createProductComment: async (
    serviceId: number,
    payload: { content: string; rating?: number | null; mentions?: number[]; parent_comment_id?: number | null; product_index?: number | null }
  ) => {
    return apiCall(`/api/services/${serviceId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateProductComment: async (
    commentId: number,
    payload: { content?: string; rating?: number | null; mentions?: number[] }
  ) => {
    // ✅ CORRIGÉ 2026-03-18: Backend route uses PUT, not PATCH
    return apiCall(`/api/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  deleteProductComment: async (commentId: number) => {
    return apiCall(`/api/comments/${commentId}`, {
      method: 'DELETE',
    });
  },
  toggleCommentReaction: async (commentId: number, reactionType: string) => {
    return apiCall(`/api/comments/${commentId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({
        reaction_type: reactionType,
      }),
    });
  },
};

// Export pour compatibilité avec les anciens imports
export const aiService = {
  chat: async (message: string) => {
    return apiCall('/api/ia/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
};

// Export pour compatibilité avec les anciens imports
export const apiPost = async <T>(endpoint: string, data: any): Promise<ApiResponse<T>> => {
  return apiCall<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// Export pour compatibilité avec les anciens imports  
// ✅ AMÉLIORÉ: Support des paramètres de requête (pagination, etc.)
export const apiGet = async <T>(
  endpoint: string,
  options?: { params?: Record<string, any> }
): Promise<ApiResponse<T>> => {
  // ✅ Construire l'URL avec les paramètres de requête
  let url = endpoint;
  if (options?.params && Object.keys(options.params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryString}`;
    }
  }

  return apiCall<T>(url, {
    method: 'GET',
  });
};

// ✅ AJOUT: apiPatch pour les mises à jour partielles
export const apiPatch = async <T>(endpoint: string, data?: any): Promise<ApiResponse<T>> => {
  return apiCall<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
};

// ✅ AJOUT: apiPut pour les mises à jour complètes
export const apiPut = async <T>(endpoint: string, data: any): Promise<ApiResponse<T>> => {
  return apiCall<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

// ✅ AJOUT: apiDelete pour les suppressions
export const apiDelete = async <T>(endpoint: string): Promise<ApiResponse<T>> => {
  return apiCall<T>(endpoint, {
    method: 'DELETE',
  });
};

// ===== DIAGNOSTICS RÉSEAU =====
export const networkDiagnostics = {
  // Test de connectivité au backend
  checkConnectivity: async () => {
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_BASE_URL}/api/test/ping`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          isOnline: true,
          apiReachable: true,
          responseTime,
          error: null,
        };
      } else {
        return {
          isOnline: true,
          apiReachable: false,
          responseTime,
          error: `Erreur HTTP ${response.status}`,
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        isOnline: false,
        apiReachable: false,
        responseTime,
        error: error.message || 'Impossible de se connecter au serveur',
      };
    }
  },
};

// Export pour compatibilité avec les anciens imports
export const serviceService = servicesApi;

// Export nommé 'api' pour compatibilité avec les hooks qui importent { api }
export const api = {
  authApi,
  servicesApi,
  iaApi,
  userApi,
  locationApi,
  notificationsApi,
  commentsApi,
  aiService,
  serviceService: servicesApi,
  networkDiagnostics,
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  put: apiPut,
  delete: apiDelete,
};

export default {
  authApi,
  servicesApi,
  iaApi,
  userApi,
  locationApi,
  notificationsApi,
  commentsApi,
  aiService,
  serviceService,
  networkDiagnostics,
};















