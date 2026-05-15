// Service API centralise avec gestion d'authentification amelioree
// Remplace les appels fetch directs avec gestion des tokens
//
// ✅ 2026-05-15 : retry exponentiel pour la mauvaise qualité internet
// (typique CM/Afrique). Backoff 1s/3s/7s sur 3 tentatives max, uniquement
// pour les erreurs réseau (TypeError) / timeout (AbortError) / 5xx serveur.
// Les méthodes idempotentes (GET) retry par défaut ; POST/PATCH/PUT/DELETE
// ne retry QUE si l'appelant met explicitement `retry: N` (sinon risque de
// doublons sur création).

import { API_BASE_URL } from '../config/api.config';
import { getValidToken } from '../utils/auth';

interface ApiServiceOptions extends RequestInit {
  isAuthenticated?: boolean;
  /** Nombre max de tentatives (incluse la 1ère). 0 ou 1 = pas de retry.
   *  Si undefined : 3 pour GET (idempotent), 1 pour les autres méthodes. */
  retry?: number;
  /** Délai en ms entre la tentative N et N+1. Si undefined : exponentiel
   *  1000, 3000, 7000. */
  retryDelays?: number[];
  /** Timeout en ms par tentative. Défaut 30000 (30s). Sur connexion lente
   *  CM/4G dégradée, on peut allonger pour les appels coûteux (scan IA). */
  timeoutMs?: number;
}

const DEFAULT_RETRY_DELAYS = [1000, 3000, 7000];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetryStatus = (status: number): boolean => {
  // 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
  // 408 Request Timeout, 429 Too Many Requests (avec backoff)
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
};

const shouldRetryError = (error: unknown): boolean => {
  if (error instanceof TypeError && /failed to fetch|network/i.test(error.message)) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  // Erreur custom de notre catch initial — message normalisé
  if (error instanceof Error && /connexion internet|requ[êe]te a expir/i.test(error.message)) return true;
  return false;
};

const attemptFetch = async (
  url: string,
  config: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  // On clone le signal externe si fourni, sinon on crée un timeout dédié
  // par tentative — important pour le retry (chaque tentative a son budget).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const userSignal = config.signal;
  const linked = userSignal
    ? (() => {
        if (userSignal.aborted) controller.abort();
        else userSignal.addEventListener('abort', () => controller.abort(), { once: true });
        return controller.signal;
      })()
    : controller.signal;
  try {
    return await fetch(url, { ...config, signal: linked });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const apiService = async (
  endpoint: string,
  options: ApiServiceOptions = {}
): Promise<Response> => {
  const {
    isAuthenticated = true,
    headers,
    retry,
    retryDelays = DEFAULT_RETRY_DELAYS,
    timeoutMs = 30000,
    ...rest
  } = options;
  const { signal: _signal, ...requestOptions } = rest;

  const method = (requestOptions.method || 'GET').toUpperCase();
  // Idempotent GET : retry par défaut. Autres méthodes : pas de retry par
  // défaut pour éviter les doublons sur création (ex: POST medication-alert).
  // L'appelant peut forcer via { retry: N }.
  const maxAttempts = Math.max(1, retry ?? (method === 'GET' ? 3 : 1));

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': window.location.origin,
  };

  if (isAuthenticated) {
    const token = getValidToken();
    if (token) {
      (defaultHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn(`Attempted to make authenticated request to ${endpoint} without a token.`);
    }
  }

  const config: RequestInit = {
    ...requestOptions,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  const baseUrl = API_BASE_URL;
  const url = `${baseUrl}${endpoint}`;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt === 1) {
        console.log(`[API Service] ${method} ${url}`);
      } else {
        console.warn(
          `[API Service] ${method} ${url} — retry ${attempt}/${maxAttempts}`,
        );
      }

      const response = await attemptFetch(url, config, timeoutMs);

      // Retry sur statuts serveur "transitoires" si tentatives restantes
      if (!response.ok && shouldRetryStatus(response.status) && attempt < maxAttempts) {
        console.warn(
          `[API Service] ${method} ${endpoint} → HTTP ${response.status}, retry programmé`,
        );
        const delay = retryDelays[attempt - 1] ?? retryDelays[retryDelays.length - 1];
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        if (response.status === 401 && isAuthenticated) {
          console.error('Unauthorized access. Token might be invalid or expired.');
        }
        const errorBody = await response
          .json()
          .catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorBody.message || `API error: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      // Normalisation message
      let normalizedMsg: string | null = null;
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        normalizedMsg = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        normalizedMsg = 'La requête a expiré. Veuillez réessayer.';
      }

      if (shouldRetryError(error) && attempt < maxAttempts) {
        const delay = retryDelays[attempt - 1] ?? retryDelays[retryDelays.length - 1];
        console.warn(
          `[API Service] ${method} ${endpoint} → erreur réseau, retry dans ${delay}ms`,
          error,
        );
        await sleep(delay);
        continue;
      }

      // Dernière tentative : on relance avec un message normalisé si applicable
      if (normalizedMsg) {
        console.error(`[API Service] ${method} ${endpoint} échec définitif :`, error);
        throw new Error(normalizedMsg);
      }
      console.error(`[API Service] ${method} ${endpoint} :`, error);
      throw error;
    }
  }

  // Inatteignable, mais TypeScript veut un retour
  throw lastError ?? new Error('apiService: unreachable');
};

// Helper function for GET requests
export const apiGet = async (endpoint: string, options: ApiServiceOptions = {}) => {
  return apiService(endpoint, { ...options, method: 'GET' });
};

// Helper function for POST requests
export const apiPost = async (endpoint: string, data: any, options: ApiServiceOptions = {}) => {
  return apiService(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// Helper function for PUT requests
export const apiPut = async (endpoint: string, data: any, options: ApiServiceOptions = {}) => {
  return apiService(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const apiPatch = async (endpoint: string, data: any, options: ApiServiceOptions = {}) => {
  return apiService(endpoint, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

// Helper function for DELETE requests
export const apiDelete = async (endpoint: string, options: ApiServiceOptions = {}) => {
  return apiService(endpoint, { ...options, method: 'DELETE' });
};

// Helper function for file uploads (multipart/form-data)
export const apiUpload = async (endpoint: string, file: File, fieldName: string = 'file', additionalData?: Record<string, string>) => {
  const formData = new FormData();
  formData.append(fieldName, file);

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  const token = localStorage.getItem('token');
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erreur lors de l\'upload' }));
    throw new Error(error.message || 'Erreur lors de l\'upload');
  }

  return response.json();
};
