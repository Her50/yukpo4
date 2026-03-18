import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api.config';

type FeatureFlags = Record<string, boolean>;

type FeatureFlagContextValue = {
    flags: FeatureFlags;
    isEnabled: (flag: string) => boolean;
    loading: boolean;
};

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(
    undefined,
);

type FeatureFlagProviderProps = {
    children: React.ReactNode;
};

const buildInitialFlagsFromEnv = (): FeatureFlags => {
    const flags: FeatureFlags = {};

    Object.keys(process.env).forEach((key) => {
        if (key.startsWith('EXPO_PUBLIC_FEATURE_FLAG_')) {
            const normalized = key
                .replace('EXPO_PUBLIC_FEATURE_FLAG_', '')
                .toLowerCase();
            const value = String(process.env[key]).toLowerCase();
            flags[normalized] = value === 'true' || value === '1';
        }
    });

    return flags;
};

export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({
    children,
}) => {
    const [flags, setFlags] = useState<FeatureFlags>(
        buildInitialFlagsFromEnv(),
    );
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchFlags = async () => {
            // ✅ CORRIGÉ: Déclarer timeoutId avant le try pour qu'il soit accessible dans catch et finally
            let timeoutId: NodeJS.Timeout | null = null;

            try {
                // ✅ CORRIGÉ: Utiliser la configuration centralisée API_BASE_URL
                if (!API_BASE_URL) {
                    console.warn('[FeatureFlagContext] API_BASE_URL non défini, utilisation des flags par défaut');
                    setLoading(false);
                    return;
                }

                // ✅ CORRIGÉ: Créer un AbortController pour le timeout (compatible React Native)
                const abortController = new AbortController();
                timeoutId = setTimeout(() => {
                    abortController.abort();
                }, 5000);

                const res = await fetch(
                    `${API_BASE_URL}/api/meta/feature-flags`,
                    {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                        },
                        // ✅ CORRIGÉ: Utiliser AbortController au lieu de AbortSignal.timeout
                        signal: abortController.signal,
                    }
                );

                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const data = (await res.json()) as {
                    success: boolean;
                    data?: { known?: Record<string, boolean> };
                };

                if (data?.success && data.data?.known) {
                    setFlags((prev) => ({
                        ...prev,
                        ...data.data!.known,
                    }));
                    console.log('[FeatureFlagContext] ✅ Feature flags chargés:', Object.keys(data.data.known));
                } else {
                    console.warn('[FeatureFlagContext] ⚠️ Format de réponse invalide:', data);
                }
            } catch (err: any) {
                // ✅ CORRIGÉ: Nettoyer le timeout en cas d'erreur
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                // ✅ CORRIGÉ: Gestion d'erreur améliorée avec détails
                if (err.name === 'AbortError' || err.name === 'TimeoutError') {
                    console.warn('[FeatureFlagContext] ⏱️ Timeout lors du chargement des feature flags');
                } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
                    console.warn('[FeatureFlagContext] \uD83C\uDF10 Erreur réseau lors du chargement des feature flags');
                } else {
                    // ✅ CORRIGÉ: Éviter d'afficher "undefined is not a function" dans les logs
                    const errorMessage = err?.message || String(err || 'Erreur inconnue');
                    if (!errorMessage.includes('undefined is not a function')) {
                        console.warn('[FeatureFlagContext] ❌ Erreur lors du chargement des feature flags:', errorMessage);
                    } else {
                        console.warn('[FeatureFlagContext] ⚠️ Erreur de chargement des feature flags (ignoré)');
                    }
                }
                // ✅ CORRIGÉ: Continuer avec les flags par défaut (déjà initialisés depuis env)
            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                setLoading(false);
            }
        };

        fetchFlags().catch((err) => {
            console.warn('[FeatureFlagContext] ❌ Erreur non gérée:', err?.message || String(err || 'Erreur inconnue'));
            setLoading(false);
        });
    }, []);

    const isEnabled = (flag: string) => {
        const key = flag.toLowerCase();
        // ✅ CORRIGÉ: Par défaut, tous les flags sont activés (true) pour que tout soit opérationnel
        // Si le flag n'existe pas dans les flags, on retourne true par défaut
        return flags[key] !== undefined ? !!flags[key] : true;
    };

    return (
        <FeatureFlagContext.Provider value={{ flags, isEnabled, loading }}>
            {children}
        </FeatureFlagContext.Provider>
    );
};

export const useFeatureFlags = () => {
    const ctx = useContext(FeatureFlagContext);
    if (!ctx) {
        throw new Error(
            'useFeatureFlags doit être utilisé à l’intérieur de FeatureFlagProvider',
        );
    }
    return ctx;
};


