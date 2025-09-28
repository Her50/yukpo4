import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import TranslationService, { LanguageConfig, TranslationResult } from '../services/translationService';

export interface UseTranslationReturn {
    currentLanguage: string;
    isTranslating: boolean;
    translate: (text: string, targetLanguage?: string, sourceLanguage?: string) => Promise<string>;
    translateBatch: (texts: string[], targetLanguage?: string, sourceLanguage?: string) => Promise<TranslationResult[]>;
    setLanguage: (languageCode: string) => Promise<void>;
    getSupportedLanguages: () => LanguageConfig[];
    getLanguageConfig: (languageCode: string) => LanguageConfig | undefined;
    clearCache: () => void;
    getCacheSize: () => number;
}

export const useTranslation = (): UseTranslationReturn => {
    const [currentLanguage, setCurrentLanguage] = useState<string>('fr');
    const [isTranslating, setIsTranslating] = useState<boolean>(false);
    const [translationService] = useState<TranslationService>(() => TranslationService.getInstance());

    // Charger la langue au montage
    useEffect(() => {
        const loadLanguage = async () => {
            const language = translationService.getCurrentLanguage();
            setCurrentLanguage(language);
        };
        loadLanguage();
    }, [translationService]);

    const translate = useCallback(async (
        text: string,
        targetLanguage?: string,
        sourceLanguage?: string
    ): Promise<string> => {
        if (!text || text.trim() === '') {
            return text;
        }

        setIsTranslating(true);
        try {
            const result = await translationService.translateWithFallback(
                text,
                targetLanguage,
                sourceLanguage
            );
            return result;
        } catch (error) {
            console.warn('Erreur traduction:', error);
            return text; // Retourner le texte original en cas d'erreur
        } finally {
            setIsTranslating(false);
        }
    }, [translationService]);

    const translateBatch = useCallback(async (
        texts: string[],
        targetLanguage?: string,
        sourceLanguage?: string
    ): Promise<TranslationResult[]> => {
        if (!texts || texts.length === 0) {
            return [];
        }

        setIsTranslating(true);
        try {
            const results = await translationService.translateBatch(
                texts,
                targetLanguage,
                sourceLanguage
            );
            return results;
        } catch (error) {
            console.warn('Erreur traduction batch:', error);
            return texts.map(text => ({
                translatedText: text,
                detectedLanguage: 'unknown',
                confidence: 0
            }));
        } finally {
            setIsTranslating(false);
        }
    }, [translationService]);

    const setLanguage = useCallback(async (languageCode: string): Promise<void> => {
        try {
            await translationService.setLanguage(languageCode);
            setCurrentLanguage(languageCode);
        } catch (error) {
            console.warn('Erreur changement langue:', error);
            Alert.alert(
                'Erreur',
                'Impossible de changer la langue. Veuillez réessayer.',
                [{ text: 'OK' }]
            );
        }
    }, [translationService]);

    const getSupportedLanguages = useCallback((): LanguageConfig[] => {
        return translationService.getSupportedLanguages();
    }, [translationService]);

    const getLanguageConfig = useCallback((languageCode: string): LanguageConfig | undefined => {
        return translationService.getLanguageConfig(languageCode);
    }, [translationService]);

    const clearCache = useCallback((): void => {
        translationService.clearCache();
    }, [translationService]);

    const getCacheSize = useCallback((): number => {
        return translationService.getCacheSize();
    }, [translationService]);

    return {
        currentLanguage,
        isTranslating,
        translate,
        translateBatch,
        setLanguage,
        getSupportedLanguages,
        getLanguageConfig,
        clearCache,
        getCacheSize,
    };
};

export default useTranslation;



