import React, { createContext, useContext, useEffect, useState } from 'react';

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
    const env = import.meta.env;

    Object.keys(env).forEach((key) => {
        if (key.startsWith('VITE_FEATURE_FLAG_')) {
            const normalized = key
                .replace('VITE_FEATURE_FLAG_', '')
                .toLowerCase();
            const value = String(env[key]).toLowerCase();
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
            try {
                const res = await fetch('/api/meta/feature-flags');
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
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
                }
            } catch (err) {
                // En cas d'erreur, on garde simplement les flags issus de l'env
                // eslint-disable-next-line no-console
                console.warn('[FeatureFlagProvider] fetch failed', err);
            } finally {
                setLoading(false);
            }
        };

        fetchFlags().catch(() => {
            setLoading(false);
        });
    }, []);

    const isEnabled = (flag: string) => {
        const key = flag.toLowerCase();
        return !!flags[key];
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



