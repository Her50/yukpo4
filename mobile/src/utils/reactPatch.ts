/**
 * PATCH GLOBAL POUR REACT - Intercepte tous les useEffect
 * Garantit qu'aucun useEffect ne retourne de valeur non-fonction
 * 
 * Ce patch DOIT être importé avant tout autre code React dans App.tsx
 */

import { DependencyList, EffectCallback, useEffect as originalUseEffect } from 'react';

// Variable pour vérifier si le patch est déjà appliqué
let isPatched = false;

// Wrapper sécurisé pour useEffect
const safeUseEffect = (
    effect: EffectCallback,
    deps?: DependencyList
): void => {
    return originalUseEffect(() => {
        let cleanup: ReturnType<EffectCallback> = undefined;

        try {
            cleanup = effect();
        } catch (error) {
            console.error('[safeUseEffect] ⚠️ Erreur dans l\'effet:', error);
            return undefined;
        }

        // ✅ CRITIQUE: Valider que cleanup est une fonction ou undefined
        if (cleanup !== undefined && cleanup !== null) {
            if (typeof cleanup !== 'function') {
                console.error('[safeUseEffect] ⚠️ ATTENTION: useEffect retourne une valeur non-fonction:', {
                    type: typeof cleanup,
                    value: cleanup,
                    stack: new Error().stack
                });
                // Retourner undefined au lieu de la valeur invalide
                return undefined;
            }
        }

        // Si cleanup est une fonction, retourner un wrapper sécurisé
        if (typeof cleanup === 'function') {
            return () => {
                try {
                    cleanup();
                } catch (error) {
                    console.error('[safeUseEffect] ⚠️ Erreur dans cleanup:', error);
                }
            };
        }

        return undefined;
    }, deps);
};

// Fonction pour appliquer le patch global
export const patchReactUseEffect = (ReactInstance: any) => {
    if (isPatched) {
        console.warn('[reactPatch] Patch déjà appliqué, ignoré');
        return;
    }

    try {
        // Sauvegarder l'original
        const originalUseEffect = ReactInstance.useEffect;

        // ✅ CRITIQUE: Remplacer React.useEffect
        ReactInstance.useEffect = safeUseEffect;

        // Aussi remplacer dans les exports si disponible
        if (ReactInstance.default && ReactInstance.default.useEffect) {
            ReactInstance.default.useEffect = safeUseEffect;
        }

        // ✅ CRITIQUE: Patcher aussi le module 'react' directement pour intercepter les imports directs
        // Cela garantit que même les imports `import { useEffect } from 'react'` utilisent le patch
        try {
            const reactModule = require('react');
            if (reactModule && reactModule.useEffect) {
                reactModule.useEffect = safeUseEffect;
            }
            // Aussi pour les exports nommés
            if (reactModule && typeof reactModule === 'object') {
                Object.defineProperty(reactModule, 'useEffect', {
                    value: safeUseEffect,
                    writable: true,
                    configurable: true
                });
            }
        } catch (requireError) {
            // En mode production ou si require n'est pas disponible, on continue quand même
            console.warn('[reactPatch] Impossible de patcher le module react directement:', requireError);
        }

        isPatched = true;
        console.log('[reactPatch] ✅ Patch useEffect appliqué globalement (React.useEffect + imports directs)');
    } catch (error) {
        console.error('[reactPatch] ❌ Erreur application du patch:', error);
    }
};

// Export du useEffect sécurisé pour usage direct
export { safeUseEffect as useEffect };

export default patchReactUseEffect;

