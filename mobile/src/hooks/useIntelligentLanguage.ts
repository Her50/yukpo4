/**
 * Hook pour la gestion intelligente des langues
 * Détection automatique, apprentissage des préférences utilisateur, traduction contextuelle
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { languageDetectionService } from '../services/languageDetectionService';

const LANGUAGE_STORAGE_KEY = 'intelligent_language_preference';
const TRANSLATION_CACHE_KEY = 'translation_cache';
const LANGUAGE_USAGE_KEY = 'language_usage_stats';

interface TranslationCache {
    [key: string]: {
        [targetLang: string]: string;
    };
}

interface LanguageUsageStat {
    language: string;
    timestamp: number;
    context: string;
    platform: string;
}

export const useIntelligentLanguage = () => {
    const { language: contextLanguage, setLanguage: setContextLanguage } = useLanguageSafe();
    const [currentLanguage, setCurrentLanguage] = useState<string>(contextLanguage || 'fr');
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectionResult, setDetectionResult] = useState<any>(null);
    const [translationCache, setTranslationCache] = useState<TranslationCache>({});
    const [languageUsageStats, setLanguageUsageStats] = useState<LanguageUsageStat[]>([]);
    const [autoTranslationEnabled, setAutoTranslationEnabled] = useState(true);
    const cacheRef = useRef<TranslationCache>({});
    const statsRef = useRef<LanguageUsageStat[]>([]);

    // Charger les données sauvegardées au démarrage
    useEffect(() => {
        const loadSavedData = async () => {
            try {
                // Charger la langue préférée
                const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
                if (savedLanguage) {
                    setCurrentLanguage(savedLanguage);
                    setContextLanguage(savedLanguage);
                }

                // Charger le cache de traduction
                const cached = await AsyncStorage.getItem(TRANSLATION_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    setTranslationCache(parsed);
                    cacheRef.current = parsed;
                }

                // Charger les statistiques d'usage
                const stats = await AsyncStorage.getItem(LANGUAGE_USAGE_KEY);
                if (stats) {
                    const parsed = JSON.parse(stats);
                    setLanguageUsageStats(parsed);
                    statsRef.current = parsed;
                }
            } catch (error) {
                console.error('[useIntelligentLanguage] Erreur chargement données:', error);
            }
        };

        loadSavedData().catch(error => {
            console.error('[useIntelligentLanguage] Erreur loadSavedData:', error);
        });
    }, [setContextLanguage]);

    // Sauvegarder le cache périodiquement
    useEffect(() => {
        const saveCache = async () => {
            try {
                await AsyncStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cacheRef.current));
            } catch (error) {
                console.error('[useIntelligentLanguage] Erreur sauvegarde cache:', error);
            }
        };

        const interval = setInterval(saveCache, 60000); // Toutes les minutes
        return () => clearInterval(interval);
    }, []);

    // Détecter et définir la langue optimale
    const detectAndSetLanguage = useCallback(async () => {
        setIsDetecting(true);
        try {
            // 1. Vérifier la langue sauvegardée
            const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
            if (savedLanguage) {
                setCurrentLanguage(savedLanguage);
                setContextLanguage(savedLanguage);
                setDetectionResult({ source: 'saved', language: savedLanguage });
                setIsDetecting(false);
                return;
            }

            // 2. Détecter depuis les paramètres système
            const systemLocales = Localization.getLocales();
            const systemLanguage = systemLocales[0]?.languageCode || 'fr';

            // 3. Analyser les statistiques d'usage pour déterminer la préférence
            const usageStats = statsRef.current;
            if (usageStats.length > 0) {
                const languageCounts: Record<string, number> = {};
                usageStats.forEach(stat => {
                    languageCounts[stat.language] = (languageCounts[stat.language] || 0) + 1;
                });

                const mostUsedLanguage = Object.entries(languageCounts)
                    .sort(([, a], [, b]) => b - a)[0]?.[0];

                if (mostUsedLanguage && languageCounts[mostUsedLanguage] > 5) {
                    const detectedLanguage = mostUsedLanguage;
                    setCurrentLanguage(detectedLanguage);
                    setContextLanguage(detectedLanguage);
                    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, detectedLanguage);
                    setDetectionResult({
                        source: 'usage_stats',
                        language: detectedLanguage,
                        confidence: languageCounts[detectedLanguage] / usageStats.length
                    });
                    setIsDetecting(false);
                    return;
                }
            }

            // 4. Utiliser la langue système ou français par défaut
            const detectedLanguage = ['fr', 'en'].includes(systemLanguage) ? systemLanguage : 'fr';
            setCurrentLanguage(detectedLanguage);
            setContextLanguage(detectedLanguage);
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, detectedLanguage);
            setDetectionResult({
                source: 'system',
                language: detectedLanguage,
                systemLanguage
            });
        } catch (error) {
            console.error('[useIntelligentLanguage] Erreur détection langue:', error);
            setDetectionResult({ source: 'error', language: 'fr' });
        } finally {
            setIsDetecting(false);
        }
    }, [setContextLanguage]);

    // Changer de langue
    const changeLanguage = useCallback(async (language: string) => {
        try {
            setCurrentLanguage(language);
            setContextLanguage(language);
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);

            // Enregistrer l'usage
            languageDetectionService.recordLanguageUsage(language, 'mobile');
        } catch (error) {
            console.error('[useIntelligentLanguage] Erreur changement langue:', error);
        }
    }, [setContextLanguage]);

    // Traduire du texte
    const translateText = useCallback(async (text: string, context?: string): Promise<string> => {
        if (!text || !autoTranslationEnabled || currentLanguage === 'fr') {
            return text; // Pas de traduction nécessaire
        }

        // Vérifier le cache
        const cacheKey = `${text}_${context || 'default'}`;
        if (cacheRef.current[cacheKey]?.[currentLanguage]) {
            return cacheRef.current[cacheKey][currentLanguage];
        }

        try {
            // Pour l'instant, retourner le texte tel quel
            // TODO: Intégrer avec un service de traduction (Google Translate API, DeepL, etc.)
            // const translated = await translationService.translate(text, 'fr', currentLanguage);

            // Simuler une traduction (à remplacer par un vrai service)
            const translated = text; // Placeholder

            // Mettre en cache
            if (!cacheRef.current[cacheKey]) {
                cacheRef.current[cacheKey] = {};
            }
            cacheRef.current[cacheKey][currentLanguage] = translated;
            setTranslationCache({ ...cacheRef.current });

            return translated;
        } catch (error) {
            console.error('[useIntelligentLanguage] Erreur traduction:', error);
            return text; // Retourner le texte original en cas d'erreur
        }
    }, [currentLanguage, autoTranslationEnabled]);

    // Activer/désactiver la traduction automatique
    const enableAutoTranslation = useCallback((enabled: boolean) => {
        setAutoTranslationEnabled(enabled);
    }, []);

    // Nettoyer les données de langue
    const clearLanguageData = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(LANGUAGE_STORAGE_KEY);
            await AsyncStorage.removeItem(TRANSLATION_CACHE_KEY);
            await AsyncStorage.removeItem(LANGUAGE_USAGE_KEY);
            setTranslationCache({});
            setLanguageUsageStats([]);
            cacheRef.current = {};
            statsRef.current = [];
        } catch (error) {
            console.error('[useIntelligentLanguage] Erreur nettoyage données:', error);
        }
    }, []);

    // Calculer les statistiques du cache
    const translationCacheStats = {
        size: Object.keys(cacheRef.current).length,
        hitRate: 0.8 // Placeholder - à calculer réellement
    };

    return {
        currentLanguage,
        isDetecting,
        detectionResult,
        changeLanguage,
        detectAndSetLanguage,
        translateText,
        languageUsageStats,
        translationCacheStats,
        enableAutoTranslation,
        clearLanguageData,
    };
};
