import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Card, TextInput } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { apiPost } from '../services/api';
import { theme } from '../theme/theme';

interface DynamicField {
  type: string;
  label: string;
  name: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface ServiceData {
  serviceId?: string;
  cout?: number;
}

const FormulaireYukpoIntelligentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { location } = useLocation();

  // État des données reçues
  const suggestion = (route.params as any)?.suggestion || {};
  const mediaData = (route.params as any)?.mediaData || {};
  const gpsData = (route.params as any)?.gpsData || {};
  const type = (route.params as any)?.type || '';
  const mode = (route.params as any)?.mode || 'edit';
  const serviceId = (route.params as any)?.serviceId;

  // États locaux
  const [activeStep, setActiveStep] = useState(1);
  const [composants, setComposants] = useState<DynamicField[]>([]);
  const [loading, setLoading] = useState(false);
  const [valeursFormulaire, setValeursFormulaire] = useState<Record<string, any>>({});
  const [mediaFiles, setMediaFiles] = useState({
    images: mediaData.base64_image || [],
    audios: mediaData.audio_base64 || [],
    videos: mediaData.video_base64 || [],
    documents: mediaData.doc_base64 || [],
    excel: mediaData.excel_base64 || [],
    logo: mediaData.logo || [],
    banner: mediaData.banner || []
  });
  const [gps, setGps] = useState<string | undefined>(undefined);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successData, setSuccessData] = useState<ServiceData | null>(null);

  // Charger les données du service à modifier
  useEffect(() => {
    const loadServiceData = async () => {
      if (mode === 'edit' && serviceId) {
        try {
          const response = await apiPost(`/api/services/${serviceId}`, {});
          const serviceData = response.data;

          // Pré-remplir les champs avec les données existantes
          if ((serviceData as any).data) {
            const existingValues: Record<string, any> = {};

            Object.keys((serviceData as any).data).forEach(key => {
              const fieldData = (serviceData as any).data[key];
              if (fieldData && fieldData.valeur) {
                existingValues[key] = fieldData.valeur;
              } else if (typeof fieldData === 'string') {
                existingValues[key] = fieldData;
              }
            });

            setValeursFormulaire(existingValues);
          }

          // Pré-remplir les médias si disponibles
          if ((serviceData as any).base64_image) {
            setMediaFiles(prev => ({
              ...prev,
              images: Array.isArray((serviceData as any).base64_image) ? (serviceData as any).base64_image : [(serviceData as any).base64_image]
            }));
          }
        } catch (error) {
          console.error('Erreur lors du chargement du service:', error);
          Alert.alert('Erreur', 'Erreur lors du chargement des données du service');
        }
      }
    };

    loadServiceData();
  }, [mode, serviceId]);

  // Initialiser le GPS
  useEffect(() => {
    if (location) {
      const gpsString = `${(location as any).coords.latitude},${(location as any).coords.longitude}`;
      setGps(gpsString);
    }
  }, [location]);

  // Générer le formulaire dynamique
  const genererFormulaire = async () => {
    setLoading(true);
    try {
      const input = {
        texte: suggestion.texte || '',
        media: {
          images: mediaFiles.images,
          audios: mediaFiles.audios,
          videos: mediaFiles.videos,
          documents: mediaFiles.documents,
          excel: mediaFiles.excel
        },
        gps: gps,
        type: type
      };

      const response = await apiPost('/api/ia/creation-service', input);
      const { composants: newComposants } = (response.data as any);

      setComposants(newComposants || []);
      setActiveStep(2);
    } catch (error) {
      console.error('Erreur génération formulaire:', error);
      Alert.alert('Erreur', 'Impossible de générer le formulaire');
    } finally {
      setLoading(false);
    }
  };

  // Soumettre le formulaire
  const soumettreFormulaire = async () => {
    setLoading(true);
    try {
      const donneesStructurees = {
        ...valeursFormulaire,
        media: mediaFiles,
        gps: gps,
        type: type,
        user_id: user?.id
      };

      const response = await apiPost('/api/services/create', donneesStructurees);
      const { service_id, cout } = (response.data as any);

      setSuccessData({ serviceId: service_id, cout });
      setShowSuccessToast(true);

      // Navigation vers le service créé
      setTimeout(() => {
        navigation.navigate('ServiceDetail' as never, { serviceId: service_id } as never);
      }, 2000);
    } catch (error) {
      console.error('Erreur soumission:', error);
      Alert.alert('Erreur', 'Impossible de créer le service');
    } finally {
      setLoading(false);
    }
  };

  // Rendre un champ dynamique
  const renderField = (field: DynamicField) => {
    const value = valeursFormulaire[field.name] || '';

    switch (field.type) {
      case 'text':
      case 'textarea':
        return (
          <TextInput
            key={field.name}
            label={field.label}
            value={value}
            onChangeText={(text) => setValeursFormulaire(prev => ({ ...prev, [field.name]: text }))}
            mode="outlined"
            multiline={field.type === 'textarea'}
            numberOfLines={field.type === 'textarea' ? 4 : 1}
            style={styles.field}
            placeholder={field.placeholder}
          />
        );

      case 'select':
        return (
          <View key={field.name} style={styles.selectContainer}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {field.options?.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.selectOption,
                    value === option && styles.selectOptionSelected
                  ]}
                  onPress={() => setValeursFormulaire(prev => ({ ...prev, [field.name]: option }))}
                >
                  <Text style={[
                    styles.selectOptionText,
                    value === option && styles.selectOptionTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case 'number':
        return (
          <TextInput
            key={field.name}
            label={field.label}
            value={value.toString()}
            onChangeText={(text) => setValeursFormulaire(prev => ({ ...prev, [field.name]: parseFloat(text) || 0 }))}
            mode="outlined"
            keyboardType="numeric"
            style={styles.field}
            placeholder={field.placeholder}
          />
        );

      default:
        return null;
    }
  };

  if (loading && activeStep === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Génération du formulaire intelligent...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {activeStep === 1 && (
        <View style={styles.stepContainer}>
          <Text style={styles.title}>Formulaire Yukpo Intelligent</Text>
          <Text style={styles.subtitle}>
            L'IA va analyser vos données et générer un formulaire personnalisé
          </Text>

          {/* Affichage des données d'entrée */}
          <Card style={styles.dataCard}>
            <Card.Content>
              <Text style={styles.cardTitle}>Données analysées</Text>
              {suggestion.texte && (
                <Text style={styles.dataText}>📝 Texte: {suggestion.texte.substring(0, 100)}...</Text>
              )}
              {mediaFiles.images.length > 0 && (
                <Text style={styles.dataText}>🖼️ Images: {mediaFiles.images.length}</Text>
              )}
              {mediaFiles.audios.length > 0 && (
                <Text style={styles.dataText}>🎵 Audio: {mediaFiles.audios.length}</Text>
              )}
              {gps && (
                <Text style={styles.dataText}>📍 GPS: {gps}</Text>
              )}
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={genererFormulaire}
            style={styles.generateButton}
            labelStyle={styles.buttonLabel}
          >
            <Ionicons name="sparkles" size={20} color="white" style={styles.buttonIcon} />
            Générer le formulaire
          </Button>
        </View>
      )}

      {activeStep === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.title}>Formulaire généré</Text>
          <Text style={styles.subtitle}>Complétez les champs requis</Text>

          {composants.map(renderField)}

          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={() => setActiveStep(1)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={20} color={theme.colors.primary} style={styles.buttonIcon} />
              Retour
            </Button>

            <Button
              mode="contained"
              onPress={soumettreFormulaire}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
              labelStyle={styles.buttonLabel}
            >
              <Ionicons name="checkmark" size={20} color="white" style={styles.buttonIcon} />
              {mode === 'edit' ? 'Mettre à jour' : 'Créer le service'}
            </Button>
          </View>
        </View>
      )}

      {showSuccessToast && successData && (
        <View style={styles.successOverlay}>
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={60} color={theme.colors.success} />
            <Text style={styles.successTitle}>Service créé avec succès !</Text>
            <Text style={styles.successText}>
              Coût: {successData.cout} tokens
            </Text>
            <Text style={styles.successSubtext}>
              Redirection vers le service...
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  stepContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  dataCard: {
    marginBottom: 30,
    backgroundColor: theme.colors.surface,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 15,
  },
  dataText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  field: {
    marginBottom: 20,
    backgroundColor: theme.colors.surface,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 10,
  },
  selectContainer: {
    marginBottom: 20,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectOptionSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectOptionText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  selectOptionTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  generateButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 5,
  },
  submitButton: {
    backgroundColor: theme.colors.success,
    borderRadius: 10,
    paddingVertical: 5,
    flex: 1,
    marginLeft: 10,
  },
  backButton: {
    borderRadius: 10,
    paddingVertical: 5,
    flex: 1,
    marginRight: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 30,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 15,
    marginBottom: 10,
  },
  successText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 5,
  },
  successSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default FormulaireYukpoIntelligentScreen;








