import * as React from 'react';
import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';

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
      const lang = (detectRes.data as any).language;
      setDetectedLang(lang);

      const translateRes = await axios.post('/api/translate', {
        text: originalText,
        target_lang: 'fr', // tu peux adapter ici dynamiquement
      });
      setTranslatedText((translateRes.data as any).translated_text);
    } catch (err) {
      console.error('Erreur IA', err);
      setTranslatedText('Erreur lors de la traduction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{maxWidth: 600, margin: 'auto', gap: 16}}>
      <TextInput
        placeholder="Entrer un texte dans n'importe quelle langue..."
        value={originalText}
        onChangeText={setOriginalText}
        multiline
        style={{borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 4}}
      />
      <TouchableOpacity onPress={handleProcess} disabled={loading}>
        <Text>{loading ? 'Analyse en cours...' : 'Détecter + Traduire'}</Text>
      </TouchableOpacity>

      {detectedLang && (
        <Text style={{fontSize: 14, color: '#666'}}>Langue détectée : {detectedLang}</Text>
      )}

      {translatedText && (
        <View style={{padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8}}>
          <Text>{translatedText}</Text>
        </View>
      )}
    </View>
  );
};

export default AutoDetectAndTranslate;





