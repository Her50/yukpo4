import * as React from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';

interface TranslatedTextProps extends TextProps {
  text: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  fallbackText?: string;
  showOriginal?: boolean;
  onTranslationComplete?: (translatedText: string) => void;
}

const TranslatedText: React.FC<TranslatedTextProps> = ({
  text,
  targetLanguage,
  sourceLanguage,
  fallbackText,
  showOriginal = false,
  onTranslationComplete,
  style,
  ...textProps
}) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  useEffect(() => {
    const translateText = async () => {
      if (!text || text.trim() === '') {
        setTranslatedText(fallbackText || text);
        return;
      }

      // Si la langue cible est la même que la langue actuelle, pas besoin de traduire
      if (targetLanguage === currentLanguage || (!targetLanguage && currentLanguage === 'fr')) {
        setTranslatedText(text);
        return;
      }

      setIsTranslating(true);
      try {
        const result = await translate(text, targetLanguage, sourceLanguage);
        setTranslatedText(result);
        onTranslationComplete?.(result);
      } catch (error) {
        console.warn('Erreur traduction texte:', error);
        setTranslatedText(fallbackText || text);
      } finally {
        setIsTranslating(false);
      }
    };

    translateText();
  }, [text, targetLanguage, sourceLanguage, currentLanguage, translate, fallbackText, onTranslationComplete]);

  const displayText = showOriginal ? text : translatedText;

  return (
    <Text
      style={[
        styles.text,
        isTranslating && styles.translating,
        style
      ]}
      {...textProps}
    >
      {displayText}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    // Styles par défaut
  },
  translating: {
    opacity: 0.7,
  },
});

export default TranslatedText;