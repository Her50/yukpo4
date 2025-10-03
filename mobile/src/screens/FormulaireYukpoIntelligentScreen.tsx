import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card, TextInput } from 'react-native-paper';
import GPSSelector from '../components/GPSSelector';
import ProductManager from '../components/ProductManager';
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
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showProductManager, setShowProductManager] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
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

    // Traiter les données GPS reçues depuis HomeScreen
    if (gpsData && Object.keys(gpsData).length > 0) {
      console.log('[FormulaireYukpoIntelligent] Données GPS reçues:', gpsData);

      if (gpsData.gps_fixe) {
        try {
          // Parser les coordonnées GPS
          const coords = gpsData.gps_fixe.split(',');
          if (coords.length === 2) {
            const lat = parseFloat(coords[0]);
            const lng = parseFloat(coords[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
              setSelectedLocation({ lat, lng });
              setValeursFormulaire(prev => ({
                ...prev,
                gps_fixe: gpsData.gps_fixe
              }));
            }
          }
        } catch (error) {
          console.warn('[FormulaireYukpoIntelligent] Erreur parsing GPS:', error);
        }
      }
    }
  }, [location, gpsData]);

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

      const response = await apiPost('/api/services/vectorize', input);
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
        (navigation as any).navigate('ServiceDetail', { serviceId: service_id });
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

          <TouchableOpacity
            onPress={genererFormulaire}
            style={styles.generateButton}
          >
            <Ionicons name="sparkles" size={20} color="white" style={styles.buttonIcon} />
            <Text style={styles.buttonLabel}>Générer le formulaire</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeStep === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.title}>Formulaire généré</Text>
          <Text style={styles.subtitle}>Complétez les champs requis</Text>

          {composants.map(renderField)}

          {/* Section GPS */}
          <Card style={styles.gpsCard}>
            <Card.Content>
              <Text style={styles.gpsTitle}>🎯 Position GPS (optionnel)</Text>
              <Text style={styles.gpsDescription}>
                Définissez une position précise pour votre service
              </Text>

              <TouchableOpacity
                style={styles.gpsButton}
                onPress={() => setShowGPSModal(true)}
              >
                <Ionicons
                  name={selectedLocation ? "location" : "location-outline"}
                  size={20}
                  color={selectedLocation ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text style={[
                  styles.gpsButtonText,
                  selectedLocation && styles.gpsButtonTextActive
                ]}>
                  {selectedLocation ? 'Position sélectionnée' : 'Sélectionner une position'}
                </Text>
              </TouchableOpacity>

              {selectedLocation && (
                <View style={styles.locationInfo}>
                  <Text style={styles.locationText}>
                    📍 {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedLocation(null);
                      setValeursFormulaire(prev => ({
                        ...prev,
                        gps_fixe: undefined
                      }));
                    }}
                    style={styles.clearLocationButton}
                  >
                    <Ionicons name="close-circle" size={16} color="#F44336" />
                  </TouchableOpacity>
                </View>
              )}

              {gps && !selectedLocation && (
                <View style={styles.currentLocationInfo}>
                  <Text style={styles.currentLocationText}>
                    📍 Position actuelle: {gps}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Section Produits */}
          <Card style={styles.productsCard}>
            <Card.Content>
              <View style={styles.productsHeader}>
                <View>
                  <Text style={styles.productsTitle}>🛍️ Produits</Text>
                  <Text style={styles.productsDescription}>
                    Gérez les produits de votre service
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.productsButton}
                  onPress={() => setShowProductManager(true)}
                >
                  <Ionicons name="cube-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.productsButtonText}>
                    {products.length > 0 ? `${products.length} produit(s)` : 'Ajouter des produits'}
                  </Text>
                </TouchableOpacity>
              </View>

              {products.length > 0 && (
                <View style={styles.productsList}>
                  {products.map((product, index) => (
                    <View key={product.id || index} style={styles.productItem}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productPrice}>
                          {product.price} {product.currency}
                        </Text>
                      </View>
                      <View style={styles.productMedia}>
                        <Text style={styles.productMediaText}>
                          📷 {product.images?.length || 0} • 🎥 {product.videos?.length || 0}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {products.length === 0 && (
                <View style={styles.noProductsContainer}>
                  <Ionicons name="cube-outline" size={32} color="#9E9E9E" />
                  <Text style={styles.noProductsText}>
                    Aucun produit ajouté
                  </Text>
                  <Text style={styles.noProductsDescription}>
                    Ajoutez des produits pour enrichir votre service
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={() => setActiveStep(1)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={20} color={theme.colors.primary} style={styles.buttonIcon} />
              <Text>Retour</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={soumettreFormulaire}
              disabled={loading}
              style={styles.submitButton}
            >
              <Ionicons name="checkmark" size={20} color="white" style={styles.buttonIcon} />
              <Text style={styles.buttonLabel}>
                {mode === 'edit' ? 'Mettre à jour' : 'Créer le service'}
              </Text>
            </TouchableOpacity>
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

      <GPSSelector
        visible={showGPSModal}
        onClose={() => setShowGPSModal(false)}
        onSelect={(coordinates) => {
          setSelectedLocation(coordinates);
          setValeursFormulaire(prev => ({
            ...prev,
            gps_fixe: `${coordinates.lat},${coordinates.lng}`
          }));
          setShowGPSModal(false);
        }}
        currentLocation={selectedLocation}
      />

      <ProductManager
        visible={showProductManager}
        onClose={() => setShowProductManager(false)}
        onSave={(savedProducts) => {
          setProducts(savedProducts);
          setValeursFormulaire(prev => ({
            ...prev,
            produits: savedProducts
          }));
        }}
        initialProducts={products}
      />
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
  gpsCard: {
    marginVertical: 16,
    elevation: 2,
  },
  gpsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  gpsDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 12,
  },
  gpsButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  gpsButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e8f5e8',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  locationText: {
    fontSize: 12,
    color: theme.colors.text,
    fontFamily: 'monospace',
    flex: 1,
  },
  clearLocationButton: {
    padding: 4,
  },
  currentLocationInfo: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  currentLocationText: {
    fontSize: 12,
    color: theme.colors.text,
    fontFamily: 'monospace',
  },
  productsCard: {
    marginVertical: 16,
    elevation: 2,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  productsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  productsDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  productsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  productsButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: 6,
  },
  productsList: {
    gap: 8,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  productMedia: {
    marginLeft: 8,
  },
  productMediaText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  noProductsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noProductsText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  noProductsDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default FormulaireYukpoIntelligentScreen;




















