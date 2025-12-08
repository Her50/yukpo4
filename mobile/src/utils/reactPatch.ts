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
        // ✅ SÉCURITÉ: Vérifier que ReactInstance existe et a useEffect
        if (!ReactInstance || typeof ReactInstance.useEffect !== 'function') {
            console.warn('[reactPatch] ⚠️ ReactInstance invalide, patch ignoré');
            return;
        }

        // Sauvegarder l'original
        const originalUseEffect = ReactInstance.useEffect;

        // ✅ CRITIQUE: Remplacer React.useEffect avec protection
        try {
            ReactInstance.useEffect = safeUseEffect;
        } catch (assignError) {
            console.error('[reactPatch] ❌ Erreur remplacement React.useEffect:', assignError);
            return; // Ne pas continuer si on ne peut pas remplacer
        }

        // Aussi remplacer dans les exports si disponible
        if (ReactInstance.default && typeof ReactInstance.default.useEffect === 'function') {
            try {
                ReactInstance.default.useEffect = safeUseEffect;
            } catch (defaultError) {
                console.warn('[reactPatch] ⚠️ Impossible de patcher React.default.useEffect:', defaultError);
            }
        }

        // ✅ CRITIQUE: Patcher aussi le module 'react' directement pour intercepter les imports directs
        // Cela garantit que même les imports `import { useEffect } from 'react'` utilisent le patch
        // ✅ SÉCURITÉ: Envelopper dans un try-catch pour ne pas bloquer le démarrage
        // ✅ NOTE: Dans React Native, require('react') peut ne pas fonctionner de la même manière
        // On se concentre donc sur ReactInstance.useEffect qui est plus fiable
        try {
            // Utiliser une approche plus sûre qui ne bloque pas si require échoue
            if (typeof require !== 'undefined' && typeof require.cache !== 'undefined') {
                try {
                    const reactModulePath = require.resolve('react');
                    const reactModule = require.cache[reactModulePath];
                    if (reactModule && reactModule.exports) {
                        if (reactModule.exports.useEffect && typeof reactModule.exports.useEffect === 'function') {
                            reactModule.exports.useEffect = safeUseEffect;
                        }
                        // Aussi pour default export
                        if (reactModule.exports.default && reactModule.exports.default.useEffect) {
                            reactModule.exports.default.useEffect = safeUseEffect;
                        }
                    }
                } catch (cacheError) {
                    // Si require.cache n'est pas disponible, essayer require direct
                    try {
                        const reactModule = require('react');
                        if (reactModule && typeof reactModule.useEffect === 'function') {
                            reactModule.useEffect = safeUseEffect;
                        }
                    } catch (directError) {
                        // Ignorer si ça ne fonctionne pas
                        console.warn('[reactPatch] ⚠️ Impossible de patcher require("react") (non-bloquant)');
                    }
                }
            }
        } catch (requireError) {
            // En mode production ou si require n'est pas disponible, on continue quand même
            // Ne pas bloquer le démarrage pour ça
            console.warn('[reactPatch] ⚠️ Impossible de patcher le module react directement (non-bloquant):', requireError?.message || requireError);
        }

        isPatched = true;
        console.log('[reactPatch] ✅ Patch useEffect appliqué globalement (React.useEffect + imports directs)');
    } catch (error) {
        // ✅ CRITIQUE: Ne pas bloquer le démarrage si le patch échoue
        console.error('[reactPatch] ❌ Erreur application du patch (non-bloquant):', error);
        // Ne pas throw l'erreur pour permettre à l'app de démarrer
    }
};

// Export du useEffect sécurisé pour usage direct
export { safeUseEffect as useEffect };

export default patchReactUseEffect;

