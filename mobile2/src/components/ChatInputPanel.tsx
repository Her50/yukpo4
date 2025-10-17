import * as React from "react";
import { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Image } from 'react-native';
import { Button, Card, Title, Paragraph } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocation } from '../contexts/LocationContext';
import { theme } from '../theme/theme';

interface MultiModalInput {
  text?: string;
  images?: string[];
  audio?: string;
  files?: string[];
  site_web?: string;
  gps_mobile?: string;
}

interface UploadedFile {
  name: string;
  data: string;
  type: string;
}

interface ChatInputPanelProps {
  onSubmit: (input: MultiModalInput) => void;
  loading?: boolean;
  onInputChange?: (length: number) => void;
  showIASuggestion?: boolean;
  placeholder?: string;
}

const ChatInputPanel: React.FC<ChatInputPanelProps> = ({
  onSubmit,
  loading = false,
  onInputChange,
  showIASuggestion = false,
  placeholder = "Décrivez votre besoin ici..."
}) => {
  const [texte, setTexte] = useState('');
  const [site_web, setSiteWeb] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  
  // États pour les fichiers multimédias
  const [base64_image, setBase64Image] = useState<UploadedFile[]>([]);
  const [audio_base64, setAudio_base64] = useState<UploadedFile[]>([]);
  const [doc_base64, setDoc_base64] = useState<UploadedFile[]>([]);
  
  // GPS
  const { location } = useLocation();
  const [gps_zone, setGpsZone] = useState<{ lat: number; lng: number } | null>(null);
  
  // Suggestions IA
  const [aiInsights, setAiInsights] = useState<{
    confidence: number;
    suggestions: string[];
    complexity: string;
    estimatedTokens: number;
  } | null>(null);

  // Initialiser le GPS au chargement
  useEffect(() => {
    if (location) {
      const coords = {
        lat: (location as any).coords.latitude,
        lng: (location as any).coords.longitude
      };
      console.log('[ChatInputPanel] Position GPS récupérée:', coords);
      setGpsZone(coords);
    }
  }, [location]);

  // Analyse IA du texte en temps réel (simulation)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (texte.trim().length > 10) {
        // Simulation d'analyse IA
        setAiInsights({
          confidence: 0.8,
          suggestions: ['Ajoutez plus de détails sur votre besoin', 'Précisez votre localisation'],
          complexity: 'medium',
          estimatedTokens: Math.floor(texte.length / 4)
        });
      } else {
        setAiInsights(null);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [texte]);

  // Gestion des changements de texte
  const handleTextChange = (text: string) => {
    setTexte(text);
    if (onInputChange) {
      onInputChange(text.length);
    }
  };

  // Prise de photo
  const takePhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uploadedFile: UploadedFile = {
          name: `photo-${Date.now()}.jpg`,
          data: `data:image/jpeg;base64,${asset.base64}`,
          type: 'image/jpeg'
        };
        setBase64Image(prev => [...prev, uploadedFile]);
      }
    } catch (error) {
      console.error('Erreur prise de photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre une photo');
    }
  }, []);

  // Sélection d'images
  const pickImages = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newFiles: UploadedFile[] = result.assets.map((asset, index) => ({
          name: `image-${Date.now()}-${index}.jpg`,
          data: `data:image/jpeg;base64,${asset.base64}`,
          type: 'image/jpeg'
        }));
        setBase64Image(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('Erreur sélection images:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner les images');
    }
  }, []);

  // Sélection de documents
  const pickDocuments = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        // Pour les documents, on simule le base64 (en réalité il faudrait lire le fichier)
        const newFiles: UploadedFile[] = result.assets.map((asset, index) => ({
          name: asset.name || `document-${index}.pdf`,
          data: `document_placeholder_${asset.name}`, // Placeholder
          type: 'application/pdf'
        }));
        setDoc_base64(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('Erreur sélection documents:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner les documents');
    }
  }, []);

  // Supprimer un fichier
  const removeFile = useCallback((index: number, type: 'image' | 'document') => {
    if (type === 'image') {
      setBase64Image(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'document') {
      setDoc_base64(prev => prev.filter((_, i) => i !== index));
    }
  }, []);

  // Soumission
  const handleSubmit = useCallback(() => {
    if (!texte.trim() && base64_image.length === 0 && doc_base64.length === 0) {
      Alert.alert('Erreur', 'Veuillez saisir un message ou ajouter des fichiers');
      return;
    }

    const input: MultiModalInput = {
      text: texte.trim() || undefined,
      site_web: site_web || undefined,
      images: base64_image.map(f => f.data),
      files: doc_base64.map(f => f.name), // En mobile, on envoie les noms
      gps_mobile: gps_zone ? JSON.stringify(gps_zone) : undefined,
    };

    console.log('[ChatInputPanel] Appel onSubmit avec:', input);
    onSubmit(input);
  }, [texte, site_web, base64_image, doc_base64, gps_zone, onSubmit]);

  // Calculer le nombre total de fichiers
  const totalFiles = base64_image.length + doc_base64.length;
  const hasAddedElements = totalFiles > 0 || site_web;

  return (
    <View style={styles.container}>
      {/* Suggestions IA */}
      {showIASuggestion && aiInsights && (
        <Card style={styles.suggestionCard}>
          <Card.Content>
            <View style={styles.suggestionHeader}>
              <Ionicons name="bulb" size={16} color={theme.colors.primary} />
              <Text style={styles.suggestionTitle}>Suggestions IA</Text>
            </View>
            {aiInsights.suggestions.map((suggestion, index) => (
              <Text key={index} style={styles.suggestionText}>• {suggestion}</Text>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Zone de texte */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={texte}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          multiline
          maxLength={1000}
          editable={!loading}
        />
      </View>

      {/* Boutons d'actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={pickImages}>
          <Ionicons name="images" size={20} color={theme.colors.primary} />
          <Text style={styles.actionText}>Images</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
          <Ionicons name="camera" size={20} color={theme.colors.primary} />
          <Text style={styles.actionText}>Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={pickDocuments}>
          <Ionicons name="document" size={20} color={theme.colors.primary} />
          <Text style={styles.actionText}>Docs</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => setShowLinkInput(!showLinkInput)}
        >
          <Ionicons name="link" size={20} color={theme.colors.primary} />
          <Text style={styles.actionText}>Lien</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || (!texte.trim() && totalFiles === 0)}
        >
          <Ionicons 
            name={loading ? "hourglass" : "send"} 
            size={20} 
            color="white" 
          />
          <Text style={styles.submitText}>
            {loading ? "Analyse..." : "Envoyer à Yukpo"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Champ lien */}
      {showLinkInput && (
        <View style={styles.linkContainer}>
          <TextInput
            style={styles.linkInput}
            value={site_web}
            onChangeText={setSiteWeb}
            placeholder="Coller un lien (URL) à analyser..."
            keyboardType="url"
          />
        </View>
      )}

      {/* Aperçus des fichiers */}
      {hasAddedElements && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>
            Éléments ajoutés ({totalFiles} fichier{totalFiles > 1 ? 's' : ''})
          </Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.previewList}>
              {/* Images */}
              {base64_image.map((file, index) => (
                <View key={`img-${index}`} style={styles.previewItem}>
                  <Image source={{ uri: file.data }} style={styles.previewImage} />
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removeFile(index, 'image')}
                  >
                    <Ionicons name="close" size={12} color="white" />
                  </TouchableOpacity>
                  <Text style={styles.previewText}>{file.name}</Text>
                </View>
              ))}

              {/* Documents */}
              {doc_base64.map((file, index) => (
                <View key={`doc-${index}`} style={styles.previewItem}>
                  <View style={styles.documentPreview}>
                    <Ionicons name="document" size={24} color={theme.colors.primary} />
                  </View>
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removeFile(index, 'document')}
                  >
                    <Ionicons name="close" size={12} color="white" />
                  </TouchableOpacity>
                  <Text style={styles.previewText}>{file.name}</Text>
                </View>
              ))}

              {/* Lien */}
              {site_web && (
                <View style={styles.previewItem}>
                  <View style={styles.linkPreview}>
                    <Ionicons name="link" size={24} color={theme.colors.primary} />
                  </View>
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => setSiteWeb('')}
                  >
                    <Ionicons name="close" size={12} color="white" />
                  </TouchableOpacity>
                  <Text style={styles.previewText}>{site_web}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionCard: {
    backgroundColor: '#f0f8ff',
    borderColor: theme.colors.primary,
    borderWidth: 1,
    marginBottom: 12,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginLeft: 8,
  },
  suggestionText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  inputContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textInput: {
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionButton: {
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    fontSize: 10,
    color: theme.colors.primary,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  linkContainer: {
    marginBottom: 12,
  },
  linkInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  previewContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  previewList: {
    flexDirection: 'row',
  },
  previewItem: {
    marginRight: 12,
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  documentPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 60,
  },
});

export default ChatInputPanel;









