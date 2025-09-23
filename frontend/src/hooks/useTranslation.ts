// Hook personnalisé pour la traduction
import { useCallback, useEffect, useState } from 'react';
import DictionaryService from '@/services/dictionaryService';

export const useTranslation = () => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('preferred_lang') || 'fr';
  });
  const [isTranslating, setIsTranslating] = useState(false);

  const dictionaryService = DictionaryService.getInstance();

  const translate = useCallback((text: string): string => {
    return dictionaryService.translate(text);
  }, []);

  const changeLanguage = useCallback((languageCode: string) => {
    setCurrentLanguage(languageCode);
    localStorage.setItem('preferred_lang', languageCode);
    
    setIsTranslating(true);
    try {
      dictionaryService.setLanguage(languageCode);
      dictionaryService.translatePage();
    } catch (error) {
      console.error('Erreur traduction:', error);
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const translatePage = useCallback(() => {
    setIsTranslating(true);
    try {
      dictionaryService.translatePage();
    } catch (error) {
      console.error('Erreur traduction page:', error);
    } finally {
      setIsTranslating(false);
    }
  }, []);

  // Initialiser la langue au chargement
  useEffect(() => {
    dictionaryService.setLanguage(currentLanguage);
  }, [currentLanguage]);

  return {
    currentLanguage,
    isTranslating,
    translate,
    changeLanguage,
    translatePage,
  };
};
