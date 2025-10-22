/**
 * Hook sécurisé pour useEffect avec validation des dépendances
 */

import { DependencyList, useEffect, useRef } from 'react';
import { errorHandler } from '../utils/errorHandler';

interface UseSafeEffectOptions {
    component?: string;
    action?: string;
    skipFirstRun?: boolean;
    dependencies?: DependencyList;
}

/**
 * Hook useEffect sécurisé qui valide les dépendances et gère les erreurs
 */
export const useSafeEffect = (
    effect: () => void | (() => void),
    deps: DependencyList = [],
    options: UseSafeEffectOptions = {}
) => {
    const { component, action, skipFirstRun = false } = options;
    const isFirstRun = useRef(true);
    const previousDeps = useRef<DependencyList>([]);

    useEffect(() => {
        // Skip first run si demandé
        if (skipFirstRun && isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        // Validation des dépendances
        if (deps.length > 0) {
            const hasChanged = deps.some((dep, index) => {
                const prevDep = previousDeps.current[index];
                return dep !== prevDep;
            });

            if (!hasChanged && !isFirstRun.current) {
                console.warn(`⚠️ [useSafeEffect] ${component || 'Unknown'} - useEffect déclenché sans changement de dépendances`);
            }
        }

        try {
            const cleanup = effect();

            // Validation de la fonction de nettoyage
            if (cleanup && typeof cleanup !== 'function') {
                console.error(`❌ [useSafeEffect] ${component || 'Unknown'} - useEffect retourne une valeur non-fonction`);
            }

            return cleanup;
        } catch (error) {
            errorHandler.handleError(error, {
                component: component || 'useSafeEffect',
                action: action || 'effect_execution',
            });
        } finally {
            previousDeps.current = [...deps];
            isFirstRun.current = false;
        }
    }, deps);
};

/**
 * Hook pour useEffect avec nettoyage automatique des timers
 */
export const useSafeTimerEffect = (
    effect: () => void | (() => void),
    deps: DependencyList = [],
    options: UseSafeEffectOptions = {}
) => {
    const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());

    useSafeEffect(() => {
        const cleanup = effect();

        return () => {
            // Nettoyer tous les timers
            timersRef.current.forEach(timer => clearTimeout(timer));
            timersRef.current.clear();

            // Appeler la fonction de nettoyage si elle existe
            if (typeof cleanup === 'function') {
                cleanup();
            }
        };
    }, deps, options);
};

export default useSafeEffect;
