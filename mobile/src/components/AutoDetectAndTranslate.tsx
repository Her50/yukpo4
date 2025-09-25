import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/buttons';
import { Textarea } from '@/components/ui/textarea';

const AutoDetectAndTranslate = () => {
  const [originalText, setOriginalText] = useState('');
  const [detectedLang, setDetectedLang] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleProcess = async () => {
    if (!originalText.trim()) return;
    setLoading(true);

    try {
      const detectRes = await axios.post('/api/detect-lang', {
        text: originalText,
      });
      const lang = detectRes.data.language;
      setDetectedLang(lang);

      const translateRes = await axios.post('/api/translate', {
        text: originalText,
        target_lang: 'fr', // tu peux adapter ici dynamiquement
      });
      setTranslatedText(translateRes.data.translated_text);
    } catch (err) {
      console.error('Erreur IA', err);
      setTranslatedText('Erreur lors de la traduction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style="max-w-2xl mx-auto space-y-4">
      <Textarea
        placeholder="Entrer un texte dans n’importe quelle langue..."
        value={originalText}
        onChange={(e) => setOriginalText(e.target.value)}
      />
      <TouchableOpacity onClick={handleProcess} disabled={loading}>
        {loading ? 'Analyse en cours...' : 'Détecter + Traduire'}
      </TouchableOpacity>

      {detectedLang && (
        <p style="text-sm text-gray-600">Langue détectée : <strong>{detectedLang}</strong></Text>
      )}

      {translatedText && (
        <View style="p-4 bg-gray-100 dark:bg-gray-800 rounded text-gray-900 dark:text-white shadow">
          {translatedText}
        </View>
      )}
    </View>
  );
};

export default AutoDetectAndTranslate;

