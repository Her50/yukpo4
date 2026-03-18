/**
 * \uD83C\uDFAF HOOK : Suggestions intelligentes pour champs de formulaire
 * 
 * Combine plusieurs sources de suggestions :
 * - Règles conditionnelles (marque → modèles)
 * - Historique utilisateur
 * - Suggestions populaires
 * - Intelligence artificielle
 * 
 * UTILISATION dans vos composants existants :
 * 
 * ```typescript
 * const suggestions = useSmartSuggestions(
 *   'telephone',
 *   'modeleTelephone',
 *   { marqueTelephone: 'Samsung' }
 * );
 * 
 * // suggestions = ['Galaxy S23', 'Galaxy A54', ...]
 * ```
 */

import { useEffect, useState } from 'react';
import { intelligentProductAutocomplete } from '../services/intelligentProductAutocomplete';

export interface SmartSuggestion {
    value: string;
    weight: number;       // Poids (0-100)
    source: 'conditional' | 'history' | 'popular' | 'ai' | 'static' | 'rules';
    relevance: number;    // Pertinence (0-100)
}

/**
 * Hook principal pour suggestions intelligentes
 */
export function useSmartSuggestions(
    productType: string,
    fieldKey: string,
    previousFields: Record<string, any> = {},
    searchQuery: string = '',
    options?: {
        enabled?: boolean;
        maxSuggestions?: number;
        minRelevance?: number;
    }
): SmartSuggestion[] {
    const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const enabled = options?.enabled !== false;
    const maxSuggestions = options?.maxSuggestions || 10;
    const minRelevance = options?.minRelevance || 30;

    useEffect(() => {
        if (!enabled) {
            setSuggestions([]);
            return;
        }

        const fetchSuggestions = async () => {
            setIsLoading(true);

            try {
                const rawSuggestions = await (intelligentProductAutocomplete as any).getSuggestions(
                    productType,
                    fieldKey,
                    previousFields,
                    searchQuery
                );

                // Transformer en SmartSuggestion avec pertinence
                const smartSuggestions: SmartSuggestion[] = rawSuggestions
                    .map(sug => ({
                        value: sug.value,
                        weight: sug.weight,
                        source: sug.source,
                        relevance: calculateRelevance(sug.value, searchQuery, sug.weight)
                    }))
                    .filter(sug => sug.relevance >= minRelevance)
                    .sort((a, b) => b.relevance - a.relevance)
                    .slice(0, maxSuggestions);

                setSuggestions(smartSuggestions);

            } catch (error) {
                console.error('[useSmartSuggestions] Erreur:', error);
                setSuggestions([]);
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce pour éviter trop d'appels
        const timeoutId = setTimeout(fetchSuggestions, 200);

        return () => clearTimeout(timeoutId);
    }, [productType, fieldKey, JSON.stringify(previousFields), searchQuery, enabled]);

    return suggestions;
}

/**
 * Calculer la pertinence d'une suggestion
 */
function calculateRelevance(value: string, query: string, baseWeight: number): number {
    if (!query) return baseWeight;

    const valueLower = value.toLowerCase();
    const queryLower = query.toLowerCase();

    // Match exact au début
    if (valueLower.startsWith(queryLower)) {
        return Math.min(100, baseWeight + 30);
    }

    // Match exact quelque part
    if (valueLower.includes(queryLower)) {
        return Math.min(100, baseWeight + 20);
    }

    // Match fuzzy (mots)
    const queryWords = queryLower.split(' ');
    const matchingWords = queryWords.filter(word => valueLower.includes(word));

    if (matchingWords.length > 0) {
        const matchRatio = matchingWords.length / queryWords.length;
        return Math.min(100, baseWeight + Math.round(matchRatio * 15));
    }

    // Pas de match direct, retourner poids de base
    return baseWeight;
}

/**
 * Hook simplifié pour obtenir juste les valeurs (pas les métadonnées)
 */
export function useSimpleSuggestions(
    productType: string,
    fieldKey: string,
    previousFields: Record<string, any> = {},
    searchQuery: string = ''
): string[] {
    const smartSuggestions = useSmartSuggestions(productType, fieldKey, previousFields, searchQuery);
    return smartSuggestions.map(s => s.value);
}

/**
 * Hook pour suggestions conditionnelles seulement
 * (Ex: marque → modèles, sans IA ni historique)
 */
export function useConditionalSuggestions(
    productType: string,
    fieldKey: string,
    previousFields: Record<string, any> = {}
): string[] {
    const [suggestions, setSuggestions] = useState<string[]>([]);

    useEffect(() => {
        const fetchConditional = async () => {
            try {
                // Cas spécifique : marque → modèles
                if (fieldKey === 'modeleTelephone' && previousFields.marqueTelephone) {
                    const { getModelesByMarque } = await import('../utils/parseExistingModalities');
                    const modeles = getModelesByMarque(previousFields.marqueTelephone, 'telephone');
                    setSuggestions(modeles);
                    return;
                }

                if (fieldKey === 'modeleAutomobile' && previousFields.marqueAutomobile) {
                    const { getModelesByMarque } = await import('../utils/parseExistingModalities');
                    const modeles = getModelesByMarque(previousFields.marqueAutomobile, 'automobile');
                    setSuggestions(modeles);
                    return;
                }

                // Autres règles conditionnelles...
                setSuggestions([]);

            } catch (error) {
                console.error('[useConditionalSuggestions] Erreur:', error);
                setSuggestions([]);
            }
        };

        fetchConditional();
    }, [productType, fieldKey, JSON.stringify(previousFields)]);

    return suggestions;
}

/**
 * Hook pour enregistrer une sélection (apprentissage)
 */
export function useRecordSelection() {
    return async (
        productType: string,
        fieldKey: string,
        value: string,
        previousFields: Record<string, any> = {}
    ) => {
        try {
            await (intelligentProductAutocomplete as any).recordSelection(
                productType,
                fieldKey,
                value,
                previousFields
            );
        } catch (error) {
            console.error('[useRecordSelection] Erreur:', error);
        }
    };
}

