import { useState, useCallback, useRef, useEffect } from 'react';
import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface UseOptimizedApiOptions<T> {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  cache?: {
    enabled: boolean;
    ttl?: number; // Time to live en millisecondes
    key?: string; // Clé personnalisée pour le cache
  };
  retry?: {
    enabled: boolean;
    maxRetries?: number;
    delay?: number; // Délai entre les tentatives en millisecondes
  };
  debounce?: {
    enabled: boolean;
    delay?: number; // Délai de debounce en millisecondes
  };
  onSuccess?: (data: T) => void;
  onError?: (error: AxiosError) => void;
  onFinally?: () => void;
}

interface UseOptimizedApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: AxiosError | null;
  execute: (config?: Partial<UseOptimizedApiOptions<T>>) => Promise<T | null>;
  refetch: () => Promise<T | null>;
  clearCache: () => void;
  clearError: () => void;
}

// Cache global pour toutes les instances
const globalCache = new Map<string, CacheEntry<any>>();

// Fonction utilitaire pour nettoyer le cache expiré
const cleanupExpiredCache = () => {
  const now = Date.now();
  for (const [key, entry] of globalCache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      globalCache.delete(key);
    }
  }
};

// Nettoyage automatique du cache toutes les 5 minutes
setInterval(cleanupExpiredCache, 5 * 60 * 1000);

// Fonction utilitaire pour générer une clé de cache
const generateCacheKey = (url: string, method: string, params?: any, data?: any): string => {
  const paramsStr = params ? JSON.stringify(params) : '';
  const dataStr = data ? JSON.stringify(data) : '';
  return `${method}:${url}:${paramsStr}:${dataStr}`;
};

// Fonction utilitaire pour attendre un délai
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useOptimizedApi<T = any>(options: UseOptimizedApiOptions<T>): UseOptimizedApiReturn<T> {
  const {
    url,
    method = 'GET',
    data: initialData,
    params: initialParams,
    headers: initialHeaders,
    cache = { enabled: false, ttl: 5 * 60 * 1000 }, // 5 minutes par défaut
    retry = { enabled: false, maxRetries: 3, delay: 1000 },
    debounce = { enabled: false, delay: 300 },
    onSuccess,
    onError,
    onFinally
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AxiosError | null>(null);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fonction principale d'exécution de la requête
  const executeRequest = useCallback(async (
    config: Partial<UseOptimizedApiOptions<T>> = {}
  ): Promise<T | null> => {
    const {
      url: configUrl = url,
      method: configMethod = method,
      data: configData = initialData,
      params: configParams = initialParams,
      headers: configHeaders = initialHeaders,
      cache: configCache = cache,
      retry: configRetry = retry
    } = config;

    // Générer la clé de cache
    const cacheKey = configCache.key || generateCacheKey(configUrl, configMethod, configParams, configData);

    // Vérifier le cache si activé
    if (configCache.enabled) {
      const cachedEntry = globalCache.get(cacheKey);
      if (cachedEntry && Date.now() - cachedEntry.timestamp < cachedEntry.ttl) {
        setData(cachedEntry.data);
        setError(null);
        onSuccess?.(cachedEntry.data);
        return cachedEntry.data;
      }
    }

    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Créer un nouveau contrôleur d'annulation
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    let lastError: AxiosError | null = null;
    const maxRetries = configRetry.enabled ? (configRetry.maxRetries || 3) : 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const axiosConfig: AxiosRequestConfig = {
          method: configMethod,
          url: configUrl,
          data: configData,
          params: configParams,
          headers: configHeaders,
          signal: abortControllerRef.current.signal,
          timeout: configUrl.includes('/api/ia/') ? 60000 : 30000, // 60s pour l'IA, 30s pour le reste
        };

        const response: AxiosResponse<T> = await axios(axiosConfig);
        const responseData = response.data;

        // Mettre en cache si activé
        if (configCache.enabled) {
          globalCache.set(cacheKey, {
            data: responseData,
            timestamp: Date.now(),
            ttl: configCache.ttl || 5 * 60 * 1000
          });
        }

        setData(responseData);
        setError(null);
        onSuccess?.(responseData);
        return responseData;

      } catch (err) {
        const axiosError = err as AxiosError;
        lastError = axiosError;

        // Ne pas retry si c'est une annulation ou une erreur 4xx (sauf 429)
        if (axiosError.name === 'AbortError' || 
            (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500 && axiosError.response.status !== 429)) {
          break;
        }

        // Attendre avant de retry (sauf pour la dernière tentative)
        if (attempt < maxRetries) {
          await delay(configRetry.delay || 1000);
        }
      }
    }

    setError(lastError);
    onError?.(lastError!);
    return null;

  }, [url, method, initialData, initialParams, initialHeaders, cache, retry, onSuccess, onError]);

  // Fonction d'exécution avec debounce
  const execute = useCallback(async (
    config?: Partial<UseOptimizedApiOptions<T>>
  ): Promise<T | null> => {
    if (debounce.enabled) {
      return new Promise((resolve) => {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(async () => {
          const result = await executeRequest(config);
          resolve(result);
        }, debounce.delay || 300);
      });
    }

    return executeRequest(config);
  }, [executeRequest, debounce]);

  // Fonction de refetch (sans cache)
  const refetch = useCallback(async (): Promise<T | null> => {
    const configWithoutCache = {
      ...options,
      cache: { ...cache, enabled: false }
    };
    return executeRequest(configWithoutCache);
  }, [executeRequest, options, cache]);

  // Fonction pour nettoyer le cache
  const clearCache = useCallback(() => {
    if (cache.key) {
      globalCache.delete(cache.key);
    } else {
      const cacheKey = generateCacheKey(url, method, initialParams, initialData);
      globalCache.delete(cacheKey);
    }
  }, [cache.key, url, method, initialParams, initialData]);

  // Fonction pour nettoyer l'erreur
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Nettoyage lors du démontage
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    refetch,
    clearCache,
    clearError
  };
}

// Hook spécialisé pour les requêtes GET avec cache
export function useCachedGet<T = any>(
  url: string,
  params?: Record<string, any>,
  options?: Partial<UseOptimizedApiOptions<T>>
) {
  return useOptimizedApi<T>({
    url,
    method: 'GET',
    params,
    cache: { enabled: true, ttl: 5 * 60 * 1000 }, // 5 minutes
    ...options
  });
}

// Hook spécialisé pour les requêtes POST avec retry
export function usePostWithRetry<T = any>(
  url: string,
  options?: Partial<UseOptimizedApiOptions<T>>
) {
  return useOptimizedApi<T>({
    url,
    method: 'POST',
    retry: { enabled: true, maxRetries: 3, delay: 1000 },
    ...options
  });
}

// Hook spécialisé pour les recherches avec debounce
export function useDebouncedSearch<T = any>(
  url: string,
  searchParams: Record<string, any>,
  options?: Partial<UseOptimizedApiOptions<T>>
) {
  return useOptimizedApi<T>({
    url,
    method: 'GET',
    params: searchParams,
    debounce: { enabled: true, delay: 300 },
    cache: { enabled: true, ttl: 2 * 60 * 1000 }, // 2 minutes pour les recherches
    ...options
  });
} 