// @ts-nocheck
import { Picker } from '@react-native-picker/picker';
import axios from "axios";
import * as React from "react";
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';

const YukAIGateway: React.FC = () => {
      const { t } = useLanguageSafe();
const [payload, setPayload] = useState("");
  const [service, setService] = useState("gpt");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`/yukai/${service}`, { payload });
      setResult(JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.error(err);
      setResult("❌ Une erreur est survenue lors de lt('yukAIGateway.appelAL')API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🤖 YukAI Gateway</Text>

      <Text style={styles.label}>{t('yukAIGateway.serviceCible')}</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={service}
          onValueChange={setService}
          style={styles.picker}
        >
          <Picker.Item label="🤖 GPT" value="gpt" />
          <Picker.Item label="🎨 DALL·E" value="dalle" />
          <Picker.Item label="🌐 Traduction" value="translate" />
        </Picker>
      </View>

      <Text style={styles.label}>{t('yukAIGateway.entreePayload')}</Text>
      <TextInput
        style={styles.textarea}
        multiline
        numberOfLines={4}
        value={payload}
        onChangeText={setPayload}
        placeholder={t('yukAIGateway.exBonjourPeuxtuMeDecrire')}
        placeholderTextColor="#9CA3AF"
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>{t('yukAIGateway.envoyer')}</Text>
        )}
      </TouchableOpacity>

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1F2937',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: 'white',
  },
  picker: {
    height: 50,
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: 'white',
  },
  button: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  resultContainer: {
    backgroundColor: '#F3F4F6',
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'monospace',
  },
});

export default YukAIGateway;
