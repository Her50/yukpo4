/**
 * Hook personnalisé pour l'autocomplete en temps réel avec debouncing
 * et gestion de l'historique de recherche
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiPost } from '../services/api';
import { debounce } from '../utils/debounce';
import SafeStorage from '../utils/safeStorage';

const SEARCH_HISTORY_KEY = '@yukpo_search_history';
const MAX_HISTORY_ITEMS = 10;
const AUTOCOMPLETE_DEBOUNCE_MS = 300;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  icon?: string;
  resultCount?: number;
}

export interface AutocompleteSuggestion {
  text: string;
  icon?: string;
  type?: 'history' | 'suggestion' | 'trending';
  metadata?: any;
}

export const useSearchAutocomplete = () => {
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoadingAutocomplete, setIsLoadingAutocomplete] = useState(false);
  const debouncedAutocompleteRef = useRef<ReturnType<typeof debounce> | null>(null);

  // Charger l'historique au démarrage
  useEffect(() => {
    // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
    loadSearchHistory().catch(error => {
      console.error('[useSearchAutocomplete] Erreur loadSearchHistory:', error);
    });
    // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
    return undefined;
  }, []);

  const loadSearchHistory = useCallback(async () => {
    try {
      const historyJson = await SafeStorage.getItem(SEARCH_HISTORY_KEY);
      if (historyJson) {
        const history = JSON.parse(historyJson) as SearchHistoryItem[];
        // Trier par timestamp décroissant et limiter
        const sortedHistory = history
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, MAX_HISTORY_ITEMS);
        setSearchHistory(sortedHistory);
      }
    } catch (error) {
      console.error('[useSearchAutocomplete] Erreur chargement historique:', error);
    }
  }, []);

  const saveToHistory = useCallback(async (query: string, resultCount?: number) => {
    if (!query.trim()) return;

    try {
      const historyJson = await SafeStorage.getItem(SEARCH_HISTORY_KEY);
      let history: SearchHistoryItem[] = historyJson ? JSON.parse(historyJson) : [];

      // Supprimer les doublons et mettre à jour le timestamp
      history = history.filter((item) => item.query.toLowerCase() !== query.toLowerCase());

      // Ajouter la nouvelle recherche en premier
      const newItem: SearchHistoryItem = {
        query: query.trim(),
        timestamp: Date.now(),
        resultCount,
      };

      history = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
      await SafeStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
      setSearchHistory(history);
    } catch (error) {
      console.error('[useSearchAutocomplete] Erreur sauvegarde historique:', error);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await SafeStorage.removeItem(SEARCH_HISTORY_KEY);
      setSearchHistory([]);
    } catch (error) {
      console.error('[useSearchAutocomplete] Erreur suppression historique:', error);
    }
  }, []);

  const removeFromHistory = useCallback(async (query: string) => {
    try {
      const historyJson = await SafeStorage.getItem(SEARCH_HISTORY_KEY);
      if (historyJson) {
        let history = JSON.parse(historyJson) as SearchHistoryItem[];
        history = history.filter((item) => item.query !== query);
        await SafeStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
        setSearchHistory(history);
      }
    } catch (error) {
      console.error('[useSearchAutocomplete] Erreur suppression item historique:', error);
    }
  }, []);

  // Fonction d'autocomplete avec debouncing
  const fetchAutocomplete = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setAutocompleteSuggestions([]);
      return;
    }

    setIsLoadingAutocomplete(true);

    try {
      // Appeler l'API d'autocomplete
      const response = await apiPost('/api/autocomplete/search-products', {
        query: query.trim(),
        limit: 5,
      });

      if (response.success && response.data) {
        const suggestions = Array.isArray(response.data)
          ? response.data.map((item: any) => ({
            text: item.text || item.query || item.nom || '',
            icon: item.icon || 'search',
            type: 'suggestion' as const,
            metadata: item,
          }))
          : [];

        // Combiner avec l'historique filtré
        const historyMatches = searchHistory
          .filter((item) =>
            item.query.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 3)
          .map((item) => ({
            text: item.query,
            icon: 'clock',
            type: 'history' as const,
            metadata: item,
          }));

        setAutocompleteSuggestions([...historyMatches, ...suggestions]);
      } else {
        // Si pas de suggestions API, utiliser seulement l'historique
        const historyMatches = searchHistory
          .filter((item) =>
            item.query.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 5)
          .map((item) => ({
            text: item.query,
            icon: 'clock',
            type: 'history' as const,
            metadata: item,
          }));
        setAutocompleteSuggestions(historyMatches);
      }
    } catch (error) {
      console.error('[useSearchAutocomplete] Erreur autocomplete:', error);
      // En cas d'erreur, utiliser seulement l'historique
      const historyMatches = searchHistory
        .filter((item) =>
          item.query.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
        .map((item) => ({
          text: item.query,
          icon: 'clock',
          type: 'history' as const,
          metadata: item,
        }));
      setAutocompleteSuggestions(historyMatches);
    } finally {
      setIsLoadingAutocomplete(false);
    }
  }, [searchHistory]);

  // Fonction pour déclencher l'autocomplete avec debouncing
  const triggerAutocomplete = useCallback(
    (query: string) => {
      // Annuler le debounce précédent
      if (debouncedAutocompleteRef.current) {
        debouncedAutocompleteRef.current.cancel();
      }

      // Créer un nouveau debounce
      const debouncedFn = debounce(() => {
        fetchAutocomplete(query);
      }, AUTOCOMPLETE_DEBOUNCE_MS);

      debouncedAutocompleteRef.current = debouncedFn as any;
      debouncedFn();
    },
    [fetchAutocomplete]
  );

  // Nettoyer le debounce au démontage
  useEffect(() => {
    return () => {
      if (debouncedAutocompleteRef.current) {
        debouncedAutocompleteRef.current.cancel();
      }
    };
  }, []);

  return {
    searchHistory,
    autocompleteSuggestions,
    isLoadingAutocomplete,
    saveToHistory,
    clearHistory,
    removeFromHistory,
    triggerAutocomplete,
    loadSearchHistory,
  };
};

