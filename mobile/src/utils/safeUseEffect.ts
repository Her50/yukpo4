/**
 * Wrapper sécurisé pour useEffect qui garantit que le cleanup retourne toujours
 * une fonction valide ou undefined, jamais null ou autre valeur
 */
import { DependencyList, EffectCallback, useEffect } from 'react';

export const safeUseEffect = (
    effect: EffectCallback,
    deps?: DependencyList
) => {
    useEffect(() => {
        let cleanup: ReturnType<EffectCallback> = undefined;

        try {
            cleanup = effect();
        } catch (error) {
            console.error('[safeUseEffect] Erreur dans l\'effet:', error);
            return undefined;
        }

        // ✅ GARANTIE: Retourner toujours une fonction ou undefined
        if (cleanup === null || cleanup === undefined) {
            return undefined;
        }

        if (typeof cleanup !== 'function') {
            console.error('[safeUseEffect] ⚠️ L\'effet retourne une valeur non-fonction:', typeof cleanup, cleanup);
            return undefined;
        }

        // ✅ Retourner une fonction wrapper pour capturer les erreurs
        return () => {
            try {
                if (typeof cleanup === 'function') {
                    cleanup();
                }
            } catch (error) {
                console.error('[safeUseEffect] Erreur dans cleanup:', error);
            }
        };
    }, deps);
};

export default safeUseEffect;

