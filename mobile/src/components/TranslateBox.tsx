import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../services/api';

const TranslateBox = () => {
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState('en');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setLoading(true);

    try {
      const response = await apiPost('/api/translate', {
        text,
        target_lang: targetLang
      });

      if (response.success && response.data) {
        setTranslated((response.data as any).translated_text);
      } else {
        setTranslated('Erreur de traduction');
      }
    } catch (err) {
      console.error('Translation error', err);
      setTranslated('Erreur de traduction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.textarea}
        placeholder="Texte à traduire"
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={4}
      />

      <View style={styles.controls}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Langue cible:</Text>
          <Picker
            selectedValue={targetLang}
            onValueChange={setTargetLang}
            style={styles.picker}
          >
            <Picker.Item label="🇬🇧 English" value="en" />
            <Picker.Item label="🇫🇷 Français" value="fr" />
            <Picker.Item label="🇵🇹 Português" value="pt" />
            <Picker.Item label="🇸🇦 العربية" value="ar" />
            <Picker.Item label="🌍 Fulfulde" value="ff" />
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleTranslate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Traduire</Text>
          )}
        </TouchableOpacity>
      </View>

      {translated && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{translated}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 640,
    alignSelf: 'center',
    gap: 16,
    padding: 16,
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pickerContainer: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  picker: {
    height: 50,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resultContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  resultText: {
    color: '#1F2937',
    fontSize: 14,
  },
});

export default TranslateBox;





