// \uD83C\uDF0D Context de Langue - Gestion globale de la langue de l'application
// ✅ Propulsé par i18next + react-i18next (standard industriel)
// ✅ Rétrocompatible : useLanguage(), useLanguageSafe(), t() fonctionnent comme avant
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { Text } from 'react-native';

import i18n, { SUPPORTED_LANGUAGES, getDeviceLanguage } from '../i18n';
import { translateWithFallback } from '../i18n/translateShared';
import SafeStorage from '../utils/safeStorage';

/** Params i18n OU chaîne de secours ; 3e arg = params si le 2e est defaultValue */
export type TranslateFn = (
    key: string,
    paramsOrFallback?: Record<string, string | number> | string,
    paramsWhenSecondIsDefault?: Record<string, string | number>,
) => string;

interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: TranslateFn;
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'fr',
    setLanguage: () => { },
    t: (key) => key,
});

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

// ✅ HOOK SAFE: Fonctionne avec ou sans provider (ne crash jamais)
export const useLanguageSafe = () => {
    try {
        const context = useContext(LanguageContext);
        if (context) {
            return context;
        }
    } catch (error) {
        console.warn('[LanguageContext] Provider non disponible, utilisation du fallback français');
    }

    // Fallback si le provider n'existe pas — utilise i18next directement
    return {
        language: 'fr',
        setLanguage: (lang: string) => {
            console.log('[LanguageContext] Fallback: setLanguage appelé mais provider absent:', lang);
        },
        t: translateWithFallback,
    };
};

interface LanguageProviderProps {
    children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
    const [language, setLanguageState] = useState<string>('fr');
    const LANGUAGE_KEY = 'app_language';
    const LANGUAGE_USER_SELECTED_KEY = 'app_language_user_selected';

    // Charger la langue sauvegardée au démarrage
    useEffect(() => {
        loadLanguage().catch(error => {
            console.error('[LanguageContext] Erreur loadLanguage:', error);
        });
        return undefined;
    }, []);

    const loadLanguage = async () => {
        try {
            const [savedLanguage, userSelected] = await Promise.all([
                SafeStorage.getItem(LANGUAGE_KEY),
                SafeStorage.getItem(LANGUAGE_USER_SELECTED_KEY),
            ]);

            // Si l'utilisateur a explicitement choisi une langue, on respecte ce choix.
            if (savedLanguage && userSelected === '1') {
                setLanguageState(savedLanguage);
                await i18n.changeLanguage(savedLanguage);
            } else {
                // Sinon, utiliser la langue système (comportement attendu au premier lancement).
                const systemLang = getDeviceLanguage();
                setLanguageState(systemLang);
                await SafeStorage.setItem(LANGUAGE_KEY, systemLang);
                await i18n.changeLanguage(systemLang);
            }
        } catch (error) {
            console.error('Erreur chargement langue:', error);
            setLanguageState('fr');
        }
    };

    const setLanguage = async (lang: string) => {
        try {
            // Valider que la langue est supportée
            const supported = SUPPORTED_LANGUAGES.map(l => l.code) as readonly string[];
            const safeLang = supported.includes(lang) ? lang : 'fr';

            setLanguageState(safeLang);
            await Promise.all([
                SafeStorage.setItem(LANGUAGE_KEY, safeLang),
                SafeStorage.setItem(LANGUAGE_USER_SELECTED_KEY, '1'),
            ]);
            await i18n.changeLanguage(safeLang);
            console.log('[Language] Langue changée:', safeLang);
        } catch (error) {
            console.error('Erreur sauvegarde langue:', error);
        }
    };

    const t: TranslateFn = translateWithFallback;

    // ✅ S'assurer que les enfants sont toujours des éléments React valides
    const safeChildren = React.Children.map(children, (child, index) => {
        if (typeof child === 'string' || typeof child === 'number') {
            return <Text key={index}>{String(child)}</Text>;
        }
        if (child == null) {
            return null;
        }
        return child;
    });

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {safeChildren}
        </LanguageContext.Provider>
    );
};

// ✅ Ré-exporter les utilitaires i18n pour usage direct dans les nouveaux écrans
export { useTranslation } from 'react-i18next';
export { SUPPORTED_LANGUAGES } from '../i18n';

