// 🌍 Context de Langue - Gestion globale de la langue de l'application
// ✅ Propulsé par i18next + react-i18next (standard industriel)
// ✅ Rétrocompatible : useLanguage(), useLanguageSafe(), t() fonctionnent comme avant
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { Text } from 'react-native';

import i18n, { SUPPORTED_LANGUAGES, getDeviceLanguage } from '../i18n';
import SafeStorage from '../utils/safeStorage';

interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
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
        t: (key: string, params?: Record<string, string | number>) => {
            const result = i18n.t(key, params as any);
            return typeof result === 'string' ? result : String(result || key);
        }
    };
};

interface LanguageProviderProps {
    children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
    const [language, setLanguageState] = useState<string>('fr');

    // Charger la langue sauvegardée au démarrage
    useEffect(() => {
        loadLanguage().catch(error => {
            console.error('[LanguageContext] Erreur loadLanguage:', error);
        });
        return undefined;
    }, []);

    const loadLanguage = async () => {
        try {
            const savedLanguage = await SafeStorage.getItem('app_language');
            if (savedLanguage) {
                setLanguageState(savedLanguage);
                // ✅ Synchroniser i18next avec la langue sauvegardée
                await i18n.changeLanguage(savedLanguage);
            } else {
                // ✅ PRIORITÉ ABSOLUE: choix utilisateur (langue système)
                // Le GPS ne sert que pour le SmartSelector, jamais pour surcharger l'utilisateur
                const systemLang = getDeviceLanguage();
                setLanguageState(systemLang);
                await SafeStorage.setItem('app_language', systemLang);
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
            await SafeStorage.setItem('app_language', safeLang);
            // ✅ Synchroniser i18next
            await i18n.changeLanguage(safeLang);
            console.log('[Language] Langue changée:', safeLang);
        } catch (error) {
            console.error('Erreur sauvegarde langue:', error);
        }
    };

    // ✅ Fonction de traduction — déléguée à i18next
    const t = (key: string, params?: Record<string, string | number>): string => {
        try {
            const result = i18n.t(key, params as any);
            // i18next retourne la clé si la traduction n'existe pas
            // S'assurer que le résultat est toujours une string
            return typeof result === 'string' ? result : String(result || key);
        } catch {
            return key;
        }
    };

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

