// 🌍 Hook React pour la gestion intelligente des langues
import { autoTranslationService } from '@/services/autoTranslationService';
import { LanguageDetectionResult, languageDetectionService } from '@/services/languageDetectionService';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface UseIntelligentLanguageReturn {
    // État actuel
    currentLanguage: string;
    isDetecting: boolean;
    detectionResult: LanguageDetectionResult | null;

    // Actions
    changeLanguage: (language: string) => Promise<void>;
    detectAndSetLanguage: () => Promise<void>;
    translateText: (text: string, context?: string) => Promise<string>;
    translateObject: (obj: any, context?: string) => Promise<any>;

    // Statistiques
    languageUsageStats: { language: string; usageCount: number; contexts: string[] }[];
    translationCacheStats: { size: number; hitRate: number };

    // Contrôles
    enableAutoTranslation: (enabled: boolean) => void;
    clearLanguageData: () => void;
}

/**
 * 🧠 Hook intelligent pour la gestion des langues
 * Combine détection GPS, habitudes utilisateur, et traduction automatique
 */
export const useIntelligentLanguage = (): UseIntelligentLanguageReturn => {
    const { i18n, t } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectionResult, setDetectionResult] = useState<LanguageDetectionResult | null>(null);

    /**
     * 🎯 Détecter et définir la langue optimale
     */
    const detectAndSetLanguage = useCallback(async () => {
        setIsDetecting(true);

        try {
            console.log('🌍 [useIntelligentLanguage] Démarrage de la détection...');

            const result = await languageDetectionService.detectOptimalLanguage();
            setDetectionResult(result);

            if (result.language !== currentLanguage) {
                await changeLanguage(result.language);
                console.log(`🌍 [useIntelligentLanguage] Langue changée vers: ${result.language} (${result.reasoning})`);
            }

        } catch (error) {
            console.error('❌ [useIntelligentLanguage] Erreur détection:', error);
        } finally {
            setIsDetecting(false);
        }
    }, [currentLanguage]);

    /**
     * 🔄 Changer de langue
     */
    const changeLanguage = useCallback(async (language: string) => {
        try {
            await i18n.changeLanguage(language);
            setCurrentLanguage(language);

            // Enregistrer la préférence
            languageDetectionService.saveLanguagePreference(language);

            // Enregistrer l'usage
            languageDetectionService.recordLanguageUsage(language, 'manual_selection');

            console.log(`🌍 [useIntelligentLanguage] Langue changée: ${language}`);

        } catch (error) {
            console.error('❌ [useIntelligentLanguage] Erreur changement langue:', error);
        }
    }, [i18n]);

    /**
     * 🌍 Traduire un texte automatiquement
     */
    const translateText = useCallback(async (text: string, context: string = 'ui'): Promise<string> => {
        try {
            const result = await autoTranslationService.translateToUserLanguage(text, context);
            return result.translatedText;
        } catch (error) {
            console.warn('⚠️ [useIntelligentLanguage] Erreur traduction:', error);
            return text; // Fallback
        }
    }, []);

    /**
     * 📝 Traduire un objet complet
     */
    const translateObject = useCallback(async (obj: any, context: string = 'content'): Promise<any> => {
        try {
            return await autoTranslationService.translateObject(obj, currentLanguage, context);
        } catch (error) {
            console.warn('⚠️ [useIntelligentLanguage] Erreur traduction objet:', error);
            return obj; // Fallback
        }
    }, [currentLanguage]);

    /**
     * ⚙️ Activer/désactiver la traduction automatique
     */
    const enableAutoTranslation = useCallback((enabled: boolean) => {
        autoTranslationService.setEnabled(enabled);
    }, []);

    /**
     * 🧹 Effacer les données de langue
     */
    const clearLanguageData = useCallback(() => {
        languageDetectionService.resetBehaviorData();
        autoTranslationService.clearCache();
        console.log('🧹 [useIntelligentLanguage] Données de langue effacées');
    }, []);

    /**
     * 📊 Obtenir les statistiques d'usage des langues
     */
    const languageUsageStats = languageDetectionService.getLanguageUsageStats();

    /**
     * 📊 Obtenir les statistiques du cache de traduction
     */
    const translationCacheStats = autoTranslationService.getCacheStats();

    // Effet pour la détection automatique au montage
    useEffect(() => {
        const initializeLanguage = async () => {
            // Vérifier si c'est la première visite
            const isFirstVisit = !localStorage.getItem('yukpo_language_initialized');

            if (isFirstVisit) {
                console.log('🌍 [useIntelligentLanguage] Première visite - détection automatique');
                await detectAndSetLanguage();
                localStorage.setItem('yukpo_language_initialized', 'true');
            } else {
                // Charger la langue préférée
                const preferredLang = localStorage.getItem('yukpo_preferred_language');
                if (preferredLang && preferredLang !== currentLanguage) {
                    await changeLanguage(preferredLang);
                }
            }
        };

        initializeLanguage();
    }, []);

    // Effet pour nettoyer les anciennes données périodiquement
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            languageDetectionService.cleanupOldBehaviorData();
        }, 24 * 60 * 60 * 1000); // Tous les jours

        return () => clearInterval(cleanupInterval);
    }, []);

    return {
        // État
        currentLanguage,
        isDetecting,
        detectionResult,

        // Actions
        changeLanguage,
        detectAndSetLanguage,
        translateText,
        translateObject,

        // Statistiques
        languageUsageStats,
        translationCacheStats,

        // Contrôles
        enableAutoTranslation,
        clearLanguageData
    };
};

export default useIntelligentLanguage;


