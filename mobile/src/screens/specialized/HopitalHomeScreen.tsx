// ✅ Écran Hôpital MODERNE - Refonte complète avec UX de niveau mondial
// ÉTAPE 1: Structure de base avec autocomplete et fonctionnalités IA

import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Image,
    Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { hospitalService, MedicalService, PathologySearchResult } from '../../services/hospitalService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

const HopitalHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [services, setServices] = useState<MedicalService[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // États autocomplete
    const [autocompleteQuery, setAutocompleteQuery] = useState('');
    const [autocompleteResults, setAutocompleteResults] = useState<MedicalService[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [selectedService, setSelectedService] = useState<MedicalService | null>(null);

    // États IA
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiMode, setAiMode] = useState<'pathology' | 'image' | null>(null);
    const [pathologyQuery, setPathologyQuery] = useState('');
    const [pathologyResults, setPathologyResults] = useState<PathologySearchResult[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageAnalysis, setImageAnalysis] = useState<any | null>(null);

    // Debounce pour autocomplete
    useEffect(() => {
        if (autocompleteQuery.trim().length < 2) {
            setAutocompleteResults([]);
            setShowAutocomplete(false);
            return;
        }

        const timer = setTimeout(() => {
            loadAutocomplete(autocompleteQuery);
        }, 300);

        return () => clearTimeout(timer);
    }, [autocompleteQuery]);

    const loadAutocomplete = async (query: string) => {
        try {
            const response = await hospitalService.searchMedicalServices(query, 10);
            if (response.success && response.services) {
                setAutocompleteResults(response.services);
                setShowAutocomplete(true);
            }
        } catch (err: any) {
            console.error('[HopitalHomeScreen] Erreur autocomplete:', err);
        }
    };

    const handleServiceSelect = (service: MedicalService) => {
        hapticPress();
        setSelectedService(service);
        setSearchQuery(service.name);
        setAutocompleteQuery(service.name);
        setShowAutocomplete(false);
        // Navigation vers recherche d'hôpitaux avec ce service
        navigation.navigate('HopitalList' as never, { 
            serviceType: service.name 
        } as never);
    };

    const handleSearchPathology = async () => {
        if (!pathologyQuery.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer une recherche');
            return;
        }

        hapticPress();
        setLoadingAI(true);
        setAiMode('pathology');

        try {
            const response = await hospitalService.searchPathology(
                pathologyQuery.trim(),
                undefined,
                location?.coords ? { lat: location.coords.latitude, lng: location.coords.longitude } : undefined
            );
            if (response.success && response.results) {
                setPathologyResults(response.results);
                setShowAIModal(true);
            } else {
                Alert.alert('Erreur', 'Impossible de rechercher la pathologie');
            }
        } catch (err: any) {
            console.error('[HopitalHomeScreen] Erreur recherche pathologie:', err);
            Alert.alert('Erreur', err.message || 'Erreur lors de la recherche');
        } finally {
            setLoadingAI(false);
        }
    };

    const handlePickImage = async () => {
        hapticPress();
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la galerie');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const base64Image = `data:image/jpeg;base64,${asset.base64}`;
            setSelectedImage(asset.uri);
            // Pour les hôpitaux, on peut analyser des images de radiologie, échographie, etc.
            // TODO: Implémenter l'analyse d'image pour hôpitaux si nécessaire
            Alert.alert('Info', 'Analyse d\'image pour hôpitaux à implémenter');
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec recherche */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#EF4444', '#F87171']}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                navigation.goBack();
                            }}
                            style={styles.backButton}
                        >
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>Hôpitaux</Text>
                            <Text style={styles.headerSubtitle}>Recherche de prestations médicales</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                setShowAIModal(true);
                                setAiMode('pathology');
                            }}
                            style={styles.aiButton}
                        >
                            <SafeIcon name="brain" size={22} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    {/* Barre de recherche avec autocomplete */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Rechercher une prestation (ex: Consultation, Urgences, Chirurgie...)"
                                placeholderTextColor="#9CA3AF"
                                value={autocompleteQuery}
                                onChangeText={(text) => {
                                    setAutocompleteQuery(text);
                                    setSearchQuery(text);
                                }}
                                onFocus={() => {
                                    if (autocompleteQuery.length >= 2) {
                                        setShowAutocomplete(true);
                                    }
                                }}
                                returnKeyType="search"
                            />
                            {autocompleteQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setAutocompleteQuery('');
                                        setSearchQuery('');
                                        setShowAutocomplete(false);
                                    }}
                                    style={styles.clearButton}
                                >
                                    <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Autocomplete dropdown */}
                        {showAutocomplete && autocompleteResults.length > 0 && (
                            <View style={styles.autocompleteContainer}>
                                <FlatList
                                    data={autocompleteResults}
                                    keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.autocompleteItem}
                                            onPress={() => handleServiceSelect(item)}
                                        >
                                            <SafeIcon name="activity" size={18} color="#EF4444" type="lucide" />
                                            <View style={styles.autocompleteItemText}>
                                                <Text style={styles.autocompleteItemName}>{item.name}</Text>
                                                {item.category && (
                                                    <Text style={styles.autocompleteItemCategory}>{item.category}</Text>
                                                )}
                                                {item.speciality && (
                                                    <Text style={styles.autocompleteItemSpeciality}>{item.speciality}</Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                    style={styles.autocompleteList}
                                    nestedScrollEnabled
                                />
                            </View>
                        )}
                    </View>

                    {/* Actions rapides IA */}
                    <View style={styles.quickActions}>
                        <TouchableOpacity
                            style={styles.quickActionButton}
                            onPress={handlePickImage}
                        >
                            <SafeIcon name="image" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.quickActionText}>Analyser image</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickActionButton}
                            onPress={() => {
                                setShowAIModal(true);
                                setAiMode('pathology');
                            }}
                        >
                            <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.quickActionText}>Recherche pathologie</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>

            {/* Contenu principal - À compléter dans les prochaines étapes */}
            <View style={styles.content}>
                <Text style={styles.placeholderText}>
                    Recherchez une prestation médicale ou utilisez les fonctionnalités IA
                </Text>
            </View>

            {/* Modal IA */}
            {showAIModal && (
                <AIModal
                    visible={showAIModal}
                    onClose={() => {
                        setShowAIModal(false);
                        setAiMode(null);
                        setPathologyResults([]);
                        setImageAnalysis(null);
                    }}
                    mode={aiMode}
                    pathologyQuery={pathologyQuery}
                    onPathologyQueryChange={setPathologyQuery}
                    onSearchPathology={handleSearchPathology}
                    pathologyResults={pathologyResults}
                    imageAnalysis={imageAnalysis}
                    selectedImage={selectedImage}
                    loading={loadingAI}
                />
            )}
        </SafeNativeView>
    );
};

// Modal IA
interface AIModalProps {
    visible: boolean;
    onClose: () => void;
    mode: 'pathology' | 'image' | null;
    pathologyQuery: string;
    onPathologyQueryChange: (text: string) => void;
    onSearchPathology: () => void;
    pathologyResults: PathologySearchResult[];
    imageAnalysis: any | null;
    selectedImage: string | null;
    loading: boolean;
}

const AIModal: React.FC<AIModalProps> = ({
    visible,
    onClose,
    mode,
    pathologyQuery,
    onPathologyQueryChange,
    onSearchPathology,
    pathologyResults,
    imageAnalysis,
    selectedImage,
    loading,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {mode === 'pathology' ? 'Recherche Pathologie IA' : 'Analyse Image IA'}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {mode === 'pathology' ? (
                            <>
                                <TextInput
                                    style={styles.pathologyInput}
                                    placeholder="Décrivez vos symptômes ou recherchez une pathologie..."
                                    value={pathologyQuery}
                                    onChangeText={onPathologyQueryChange}
                                    multiline
                                />
                                <TouchableOpacity
                                    style={styles.searchButton}
                                    onPress={onSearchPathology}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                                            <Text style={styles.searchButtonText}>Rechercher</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {pathologyResults.length > 0 && (
                                    <View style={styles.resultsContainer}>
                                        {pathologyResults.map((result, index) => (
                                            <View key={index} style={styles.pathologyCard}>
                                                <View style={styles.pathologyHeader}>
                                                    <Text style={styles.pathologyName}>{result.pathology_name}</Text>
                                                    <View style={[styles.urgencyBadge, styles[`urgency${result.urgency_level.charAt(0).toUpperCase() + result.urgency_level.slice(1)}`]]}>
                                                        <Text style={styles.urgencyText}>
                                                            {result.urgency_level === 'critical' ? 'Critique' :
                                                             result.urgency_level === 'high' ? 'Urgent' :
                                                             result.urgency_level === 'moderate' ? 'Modéré' : 'Faible'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.pathologyDescription}>{result.description}</Text>
                                                
                                                {result.symptoms.length > 0 && (
                                                    <View style={styles.symptomsContainer}>
                                                        <Text style={styles.symptomsTitle}>Symptômes:</Text>
                                                        {result.symptoms.map((symptom, i) => (
                                                            <Text key={i} style={styles.symptomItem}>• {symptom}</Text>
                                                        ))}
                                                    </View>
                                                )}

                                                {result.recommended_services.length > 0 && (
                                                    <View style={styles.servicesContainer}>
                                                        <Text style={styles.servicesTitle}>Services recommandés:</Text>
                                                        {result.recommended_services.map((service, i) => (
                                                            <Text key={i} style={styles.serviceItem}>• {service}</Text>
                                                        ))}
                                                    </View>
                                                )}

                                                {result.recommended_examinations.length > 0 && (
                                                    <View style={styles.examsContainer}>
                                                        <Text style={styles.examsTitle}>Examens recommandés:</Text>
                                                        {result.recommended_examinations.map((exam, i) => (
                                                            <Text key={i} style={styles.examItem}>• {exam}</Text>
                                                        ))}
                                                    </View>
                                                )}

                                                {result.hospitals_suggested && result.hospitals_suggested.length > 0 && (
                                                    <View style={styles.hospitalsContainer}>
                                                        <Text style={styles.hospitalsTitle}>Hôpitaux suggérés:</Text>
                                                        {result.hospitals_suggested.map((hospital, i) => (
                                                            <View key={i} style={styles.hospitalItem}>
                                                                <Text style={styles.hospitalName}>{hospital.hospital_name}</Text>
                                                                <Text style={styles.hospitalSpeciality}>{hospital.speciality}</Text>
                                                                {hospital.distance_km && (
                                                                    <Text style={styles.hospitalDistance}>
                                                                        À {hospital.distance_km.toFixed(1)} km
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}

                                                {result.recommendations.length > 0 && (
                                                    <View style={styles.recommendationsContainer}>
                                                        <Text style={styles.recommendationsTitle}>Recommandations:</Text>
                                                        {result.recommendations.map((rec, i) => (
                                                            <Text key={i} style={styles.recommendationItem}>• {rec}</Text>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </>
                        ) : (
                            <>
                                {selectedImage && (
                                    <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                                )}
                                {loading ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="large" color="#EF4444" />
                                        <Text style={styles.loadingText}>Analyse en cours...</Text>
                                    </View>
                                ) : imageAnalysis ? (
                                    <View style={styles.analysisContainer}>
                                        <Text style={styles.analysisTitle}>Résultats de l'analyse</Text>
                                        <Text style={styles.interpretation}>{imageAnalysis.interpretation}</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.placeholderText}>Aucune analyse disponible</Text>
                                )}
                            </>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerContainer: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10,
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 2,
    },
    aiButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        marginTop: 8,
        position: 'relative',
        zIndex: 100,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    clearButton: {
        padding: 4,
    },
    autocompleteContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginTop: 4,
        maxHeight: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 1000,
    },
    autocompleteList: {
        maxHeight: 300,
    },
    autocompleteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    autocompleteItemText: {
        flex: 1,
    },
    autocompleteItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    autocompleteItemCategory: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    autocompleteItemSpeciality: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 2,
        fontWeight: '600',
    },
    quickActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    quickActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 6,
    },
    quickActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    placeholderText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        padding: 20,
    },
    pathologyInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#111827',
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        gap: 8,
        marginBottom: 20,
    },
    searchButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    resultsContainer: {
        gap: 12,
    },
    pathologyCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#EF4444',
    },
    pathologyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    pathologyName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    urgencyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    urgencyCritical: {
        backgroundColor: '#FEE2E2',
    },
    urgencyHigh: {
        backgroundColor: '#FEF3C7',
    },
    urgencyModerate: {
        backgroundColor: '#DBEAFE',
    },
    urgencyLow: {
        backgroundColor: '#D1FAE5',
    },
    urgencyText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#111827',
    },
    pathologyDescription: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 12,
    },
    symptomsContainer: {
        marginTop: 12,
        marginBottom: 12,
    },
    symptomsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    symptomItem: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    servicesContainer: {
        marginTop: 12,
        marginBottom: 12,
    },
    servicesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    serviceItem: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    examsContainer: {
        marginTop: 12,
        marginBottom: 12,
    },
    examsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    examItem: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    hospitalsContainer: {
        marginTop: 12,
        marginBottom: 12,
    },
    hospitalsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    hospitalItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    hospitalName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    hospitalSpeciality: {
        fontSize: 12,
        color: '#EF4444',
        marginBottom: 4,
    },
    hospitalDistance: {
        fontSize: 12,
        color: '#6B7280',
    },
    recommendationsContainer: {
        marginTop: 12,
    },
    recommendationsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    recommendationItem: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    previewImage: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        marginBottom: 20,
        resizeMode: 'contain',
    },
    loadingContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: '#6B7280',
    },
    analysisContainer: {
        gap: 16,
    },
    analysisTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    interpretation: {
        fontSize: 16,
        color: '#111827',
        lineHeight: 24,
        marginBottom: 16,
    },
});

export default HopitalHomeScreen;

