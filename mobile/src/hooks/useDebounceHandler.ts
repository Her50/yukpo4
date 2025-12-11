/**
 * Hook pour debouncer les handlers et éviter les appels multiples
 * Utile pour les handlers de navigation et d'interaction
 */

import { useCallback, useRef } from 'react';

export interface DebounceOptions {
    delay?: number;
    leading?: boolean; // Exécuter immédiatement au premier appel
    trailing?: boolean; // Exécuter après le délai
}

/**
 * Hook pour créer un handler debouncé
 * @param handler Le handler à debouncer
 * @param options Options de debounce
 * @returns Handler debouncé
 */
export function useDebounceHandler<T extends (...args: any[]) => any>(
    handler: T,
    options: DebounceOptions = {}
): T {
    const { delay = 300, leading = false, trailing = true } = options;
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastCallTimeRef = useRef<number>(0);
    const lastArgsRef = useRef<Parameters<T> | null>(null);

    const debouncedHandler = useCallback(
        ((...args: Parameters<T>) => {
            const now = Date.now();
            lastArgsRef.current = args;

            // Si leading est true et que c'est le premier appel, exécuter immédiatement
            if (leading && timeoutRef.current === null) {
                lastCallTimeRef.current = now;
                handler(...args);
                return;
            }

            // Nettoyer le timeout précédent
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Créer un nouveau timeout
            timeoutRef.current = setTimeout(() => {
                if (trailing && lastArgsRef.current) {
                    const timeSinceLastCall = Date.now() - lastCallTimeRef.current;
                    // Exécuter seulement si le délai minimum a été respecté
                    if (timeSinceLastCall >= delay) {
                        handler(...lastArgsRef.current);
                    }
                }
                timeoutRef.current = null;
                lastArgsRef.current = null;
            }, delay);

            lastCallTimeRef.current = now;
        }) as T,
        [handler, delay, leading, trailing]
    );

    return debouncedHandler;
}

/**
 * Hook pour créer un handler avec un flag de verrouillage
 * Utile pour éviter les appels multiples pendant une opération en cours
 */
export function useLockedHandler<T extends (...args: any[]) => any>(
    handler: T,
    options: { lockDuration?: number } = {}
): T {
    const { lockDuration = 1000 } = options;
    const isLockedRef = useRef(false);
    const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const lockedHandler = useCallback(
        ((...args: Parameters<T>) => {
            if (isLockedRef.current) {
                console.warn('[useLockedHandler] Handler appelé pendant le verrouillage, ignoré');
                return;
            }

            // Verrouiller
            isLockedRef.current = true;

            // Exécuter le handler
            const result = handler(...args);

            // Déverrouiller après le délai
            if (lockTimeoutRef.current) {
                clearTimeout(lockTimeoutRef.current);
            }
            lockTimeoutRef.current = setTimeout(() => {
                isLockedRef.current = false;
                lockTimeoutRef.current = null;
            }, lockDuration);

            return result;
        }) as T,
        [handler, lockDuration]
    );

    return lockedHandler;
}

