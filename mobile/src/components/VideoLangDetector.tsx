import * as React from "react";
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { apiPost } from '../services/api';

const VideoLangDetector: React.FC = () => {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [result, setResult] = useState<{ language: string; transcription: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handlePickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur sélection vidéo:', error);
    }
  };

  const handleSubmit = async () => {
    if (!videoUri) return;
    setLoading(true);

    try {
      // Note: L'upload de vidéo nécessite une implémentation spécifique
      // Ici on simule l'appel API
      const response = await apiPost('/api/detect-lang-video', {
        video_uri: videoUri,
      });

      if (response.success && response.data) {
        const language = response.data.language;
        const transcription = response.data.transcription;
        setResult({ language, transcription });

        // Classification pour déterminer le bon formulaire
        const classifyRes = await apiPost('/api/classify-service-type', { 
          texte: transcription 
        });
        
        if (classifyRes.success) {
          const type = classifyRes.data.type_service || 'general';
          (navigation as any).navigate('FormulaireYukpoIntelligent', { type });
        }
      }
    } catch (err) {
      console.error('Erreur analyse vidéo', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎥 Analyse de la langue et redirection automatique</Text>

      <TouchableOpacity style={styles.pickButton} onPress={handlePickVideo}>
        <Text style={styles.pickButtonText}>
          {videoUri ? 'Vidéo sélectionnée' : 'Sélectionner une vidéo'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.submitButton, (!videoUri || loading) && styles.buttonDisabled]} 
        onPress={handleSubmit} 
        disabled={loading || !videoUri}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.submitButtonText}>Analyser et rediriger</Text>
        )}
      </TouchableOpacity>

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>
            🌍 Langue : <Text style={styles.bold}>{result.language}</Text>
          </Text>
          <Text style={styles.resultText}>
            📄 Texte : {result.transcription}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  pickButton: {
    padding: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    alignItems: 'center',
  },
  pickButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  submitButton: {
    padding: 12,
    backgroundColor: '#10B981',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resultContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  resultText: {
    fontSize: 14,
    marginBottom: 8,
  },
  bold: {
    fontWeight: 'bold',
  },
});

export default VideoLangDetector;





