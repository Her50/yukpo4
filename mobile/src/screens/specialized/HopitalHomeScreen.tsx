// ✅ Écran Hôpital MODERNE - Refonte complète avec UX de niveau mondial
// ÉTAPE 1: Structure de base avec autocomplete et fonctionnalités IA

import { useNavigation } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useToaster } from '../../components/ToasterProvider';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { useAIWithFallback } from '../../hooks/useAIWithFallback';
import { hospitalService, MedicalService, MedicalServiceAvailability, PathologySearchResult } from '../../services/hospitalService';
import { imageAnalysisService } from '../../services/imageAnalysisService';
import { hapticPress } from '../../utils/hapticFeedback';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'distance_asc' | 'name_asc';

const HopitalHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();
    const toaster = useToaster();

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [services, setServices] = useState<MedicalService[]>([]);
    const [availableServices, setAvailableServices] = useState<MedicalServiceAvailability[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useAvailability, setUseAvailability] = useState(true); // Utiliser le système de disponibilité par défaut

    // États UI - Tri intelligent
    const [sortBy, setSortBy] = useState<SortOption>('relevance');
    const [showSortModal, setShowSortModal] = useState(false);

    // États autocomplete
    const [autocompleteQuery, setAutocompleteQuery] = useState('');
    const [autocompleteResults, setAutocompleteResults] = useState<MedicalService[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [selectedService, setSelectedService] = useState<MedicalService | null>(null);

    // États IA (avec fallback 3 niveaux)
    const { searchPathology: aiSearchPathology } = useAIWithFallback();
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiMode, setAiMode] = useState<'pathology' | 'image' | null>(null);
    const [pathologyQuery, setPathologyQuery] = useState('');
    const [pathologyResults, setPathologyResults] = useState<PathologySearchResult[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageAnalysis, setImageAnalysis] = useState<any | null>(null);

    // Options de tri
    const sortOptions: { value: SortOption; label: string; icon: string }[] = useMemo(
        () => [
            { value: 'relevance', label: t('hopitalHome.sortRelevance'), icon: 'star' },
            { value: 'price_asc', label: t('hopitalHome.sortPriceAsc'), icon: 'arrow-up' },
            { value: 'price_desc', label: t('hopitalHome.sortPriceDesc'), icon: 'arrow-down' },
            { value: 'distance_asc', label: t('hopitalHome.sortDistance'), icon: 'map-pin' },
            { value: 'name_asc', label: t('hopitalHome.sortNameAz'), icon: 'type' },
        ],
        [t]
    );

    // Obtenir l'icône du tri courant
    const getCurrentSortIcon = () => {
        const currentOption = sortOptions.find(o => o.value === sortBy);
        return currentOption?.icon || 'arrow-up-down';
    };

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
            const r = response.data as any;
            if (response.success && r?.services) {
                setAutocompleteResults(r.services);
                setShowAutocomplete(true);
            }
        } catch (err: any) {
            console.error('[HopitalHomeScreen] Erreur autocomplete:', err);
        }
    };

    // ✅ NOUVEAU: Fonction de recherche principale
    const handleSearch = () => {
        hapticPress();
        if (!searchQuery.trim() && !autocompleteQuery.trim()) {
            // Si pas de recherche, charger tous les services disponibles
            loadAvailableServices();
            return;
        }

        const query = searchQuery.trim() || autocompleteQuery.trim();
        setShowAutocomplete(false);

        // Rechercher les services disponibles avec système de disponibilité
        if (useAvailability && location?.coords) {
            loadAvailableServices(query);
        } else {
            // Navigation vers recherche d'hôpitaux avec ce service
            navigation.navigate('HopitalList' as never, {
                serviceType: query
            } as never);
        }
    };

    const handleServiceSelect = (service: MedicalService) => {
        hapticPress();
        setSelectedService(service);
        setSearchQuery(service.name);
        setAutocompleteQuery(service.name);
        setShowAutocomplete(false);

        // Rechercher les services disponibles avec système de disponibilité
        if (useAvailability && location?.coords) {
            loadAvailableServices(service.name);
        } else {
            // Navigation vers recherche d'hôpitaux avec ce service
            navigation.navigate('HopitalList' as never, {
                serviceType: service.name
            } as never);
        }
    };

    // Charger les services disponibles avec système de disponibilité
    const loadAvailableServices = async (serviceName?: string) => {
        try {
            setLoading(true);
            setError(null);

            const response = await hospitalService.searchAvailableMedicalServices(
                serviceName || searchQuery || undefined,
                location?.coords ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : undefined,
                50 // 50km par défaut
            );

            const r = response.data as any;
            if (response.success && r) {
                setAvailableServices(r);
            } else {
                setAvailableServices([]);
            }
        } catch (err: any) {
            console.error('[HopitalHomeScreen] Erreur chargement disponibilité:', err);
            setError(t('hopitalHome.errorLoadingServices'));
            setAvailableServices([]);
        } finally {
            setLoading(false);
        }
    };

    // ✅ REFONDU: Recherche pathologie avec fallback 3 niveaux (ne plante plus jamais)
    const handleSearchPathology = async () => {
        if (!pathologyQuery.trim()) {
            toaster.warning(t('hopitalHome.pleaseEnterPathology'));
            return;
        }

        hapticPress();
        setLoadingAI(true);
        setAiMode('pathology');
        setShowAIModal(true);
        setPathologyResults([]);

        const loc = location?.coords ? { lat: location.coords.latitude, lng: location.coords.longitude } : undefined;
        const result = await aiSearchPathology(pathologyQuery.trim(), loc);

        if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
            setPathologyResults(result.data);
            if (result.source === 'local') {
                toaster?.show?.(t('hopitalHome.resultsLocalData'), 'info');
            } else {
                toaster?.show?.(t('hopitalHome.pathologiesFound', { count: result.data.length }), 'success');
            }
        } else {
            toaster?.show?.(t('hopitalHome.noResultConsultDoctor'), 'info');
            setPathologyResults([]);
        }
        setLoadingAI(false);
    };

    const handlePickImage = async (source: 'camera' | 'gallery') => {
        hapticPress();

        try {
            let result;

            if (source === 'camera') {
                // Demander permission caméra
                const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
                if (cameraStatus !== 'granted') {
                    Alert.alert(t('hopitalHome.permissionRequired'), t('hopitalHome.allowCamera'));
                    return;
                }

                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.8,
                    base64: false, // ✅ CORRIGÉ: Ne pas demander base64 directement, on va convertir
                });
            } else {
                // Demander permission galerie
                const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (galleryStatus !== 'granted') {
                    Alert.alert(t('hopitalHome.permissionRequired'), t('hopitalHome.allowGallery'));
                    return;
                }

                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.8,
                    base64: false, // ✅ CORRIGÉ: Ne pas demander base64 directement, on va convertir
                });
            }

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];

                // ✅ CORRIGÉ: Convertir l'image en JPEG avec expo-image-manipulator
                // Cela garantit que l'image est dans un format supporté par OpenAI (JPEG, PNG, GIF, WEBP)
                const manipulatedImage = await ImageManipulator.manipulateAsync(
                    asset.uri,
                    [], // Pas de transformations (redimensionnement, rotation, etc.)
                    {
                        compress: 0.8, // Compression JPEG
                        format: ImageManipulator.SaveFormat.JPEG, // ✅ FORCER le format JPEG
                        base64: true, // Demander le base64 après conversion
                    }
                );

                // ✅ Construire le data URI avec le bon type MIME (image/jpeg)
                const base64Image = `data:image/jpeg;base64,${manipulatedImage.base64}`;
                setSelectedImage(manipulatedImage.uri);
                setAiMode('image');
                setShowAIModal(true); // ✅ Ouvrir le modal immédiatement
                setLoadingAI(true);
                setImageAnalysis(null);

                // Analyser l'image avec l'IA
                const analysisResponse = await imageAnalysisService.analyzeHospitalImage(
                    base64Image,
                    'general'
                );

                const ar = analysisResponse.data as any;
                if (analysisResponse.success && ar) {
                    // Gérer différents formats de réponse
                    const analysis = ar?.analysis || ar;
                    setImageAnalysis(analysis);
                    toaster.success(t('hopitalHome.imageAnalysisDone'));
                } else {
                    const ar = analysisResponse.data as any;
                    const errorMsg = analysisResponse.error || ar?.error || t('hopitalHome.imageAnalysisErrorGeneric');
                    toaster.error(errorMsg);
                    setImageAnalysis(null);
                }
            }
        } catch (err: any) {
            console.error('[HopitalHomeScreen] Erreur sélection image:', err);
            toaster.error(err.message || t('hopitalHome.imagePickerError'));
            setLoadingAI(false);
            setImageAnalysis(null);
        } finally {
            setLoadingAI(false);
        }
    };

    const showImageSourcePicker = () => {
        Alert.alert(
            t('hopitalHome.chooseSource'),
            t('hopitalHome.howToAddImage'),
            [
                {
                    text: t('common.camera'),
                    onPress: () => handlePickImage('camera'),
                },
                {
                    text: t('common.gallery'),
                    onPress: () => handlePickImage('gallery'),
                },
                {
                    text: t('common.cancel'),
                    style: 'cancel',
                },
            ]
        );
    };

    // Réserver un RDV
    const handleBookAppointment = (service: MedicalServiceAvailability) => {
        hapticPress();
        Alert.alert(
            t('hopitalHome.bookAppointment'),
            t('hopitalHome.bookConsultation', { title: service.service_title }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.reserve'),
                    onPress: async () => {
                        try {
                            const resp = await hospitalService.bookAppointment(service.service_id, {
                                service_name: searchQuery || t('hopitalHome.consultationGenerale'),
                                notes: t('hopitalHome.notesFromApp'),
                            });
                            if ((resp as any).success) {
                                Alert.alert(t('message.success'), t('hopitalHome.appointmentBooked'));
                            } else {
                                Alert.alert(t('hopitalHome.infoTitle'), t('hopitalHome.onlineBookingUnavailable'));
                            }
                        } catch (e) {
                            Alert.alert(t('hopitalHome.infoTitle'), t('hopitalHome.onlineBookingSoon'));
                        }
                    },
                },
            ]
        );
    };

    // Vérifier le triage IA
    const handleAITriage = async () => {
        hapticPress();
        if (!pathologyQuery.trim()) {
            toaster.warning(t('hopitalHome.describeSymptomsForEval'));
            return;
        }
        setLoadingAI(true);
        try {
            const resp = await hospitalService.getAIRecommendations(
                pathologyQuery,
                undefined,
                location?.coords ? { lat: location.coords.latitude, lng: location.coords.longitude } : undefined
            );
            if ((resp as any).success && (resp as any).data?.recommendation) {
                const reco = (resp as any).data.recommendation;
                const msg = reco.preliminary_analysis || reco.advice?.join('\n') || t('hopitalHome.consultezUnMedecin');
                Alert.alert(t('hopitalHome.aiEvaluation'), msg);
            }
        } catch (e) { toaster.error(t('hopitalHome.aiServiceUnavailableShort')); }
        finally { setLoadingAI(false); }
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec recherche */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#F87171', '#FB923C']}
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
                            <Text style={styles.headerTitle}>{t('hopitalHome.hopitaux')}</Text>
                            <Text style={styles.headerSubtitle}>{t('hopitalHome.rechercheDePrestationsMedicales')}</Text>
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
                                placeholder={t('hopitalHome.placeholderPrestation')}
                                placeholderTextColor="#9CA3AF"
                                value={autocompleteQuery}
                                onChangeText={(text) => {
                                    setAutocompleteQuery(text);
                                    setSearchQuery(text);
                                }}
                                onSubmitEditing={handleSearch}
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
                            {/* ✅ NOUVEAU: Bouton de recherche */}
                            <TouchableOpacity
                                style={[styles.searchButton, (!searchQuery.trim() && !autocompleteQuery.trim()) && styles.searchButtonDisabled]}
                                onPress={handleSearch}
                                disabled={!searchQuery.trim() && !autocompleteQuery.trim()}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
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
                                            <SafeIcon name="activity" size={18} color="#DC2626" type="lucide" />
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
                            onPress={showImageSourcePicker}
                        >
                            <SafeIcon name="image" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.quickActionText}>{t('hopitalHome.quickAnalyzeImage')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickActionButton}
                            onPress={() => {
                                setShowAIModal(true);
                                setAiMode('pathology');
                            }}
                        >
                            <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.quickActionText}>{t('hopitalHome.quickPathologySearch')}</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* Barre d'actions (tri) */}
                <View style={styles.actionsBar}>
                    <TouchableOpacity
                        style={styles.sortButton}
                        onPress={() => {
                            hapticPress();
                            setShowSortModal(true);
                        }}
                        activeOpacity={0.7}
                    >
                        <SafeIcon
                            name={getCurrentSortIcon()}
                            size={18}
                            color="#6B7280"
                            type="lucide"
                        />
                        <Text style={styles.sortButtonText}>
                            {sortOptions.find(o => o.value === sortBy)?.label || t('hopitalHome.trier')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Contenu principal */}
            {loading && availableServices.length === 0 ? (
                <View style={styles.content}>
                    <ActivityIndicator size="large" color="#DC2626" />
                    <Text style={styles.placeholderText}>{t('hopitalHome.rechercheDesServicesDisponibles')}</Text>
                </View>
            ) : availableServices.length > 0 ? (
                <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                    <View style={styles.availabilityHeader}>
                        <SafeIcon name="check-circle" size={20} color="#DC2626" type="lucide" />
                        <Text style={styles.availabilityHeaderText}>
                            {t('hopitalHome.servicesAvailableNow', { count: availableServices.length })}
                        </Text>
                    </View>
                    {availableServices.map((service) => (
                        <View key={service.service_id} style={styles.serviceCard}>
                            <View style={styles.serviceCardHeader}>
                                <Text style={styles.serviceCardTitle}>{service.service_title}</Text>
                                {service.is_24h && (
                                    <View style={styles.badge24h}>
                                        <Text style={styles.badge24hText}>{t('hopitalHome.badge24h')}</Text>
                                    </View>
                                )}
                            </View>
                            {service.available_services.length > 0 && (
                                <View style={styles.servicesList}>
                                    <Text style={styles.servicesListTitle}>{t('hopitalHome.servicesDisponibles')}</Text>
                                    {service.available_services.slice(0, 5).map((s, index) => (
                                        <Text key={index} style={styles.serviceItem}>• {s}</Text>
                                    ))}
                                    {service.available_services.length > 5 && (
                                        <Text style={styles.serviceItemMore}>
                                            {t('hopitalHome.moreOthers', { count: service.available_services.length - 5 })}
                                        </Text>
                                    )}
                                </View>
                            )}
                            {service.distance_km !== undefined && (
                                <Text style={styles.distanceText}>
                                    {t('hopitalHome.distancePin', { distance: service.distance_km.toFixed(1) })}
                                </Text>
                            )}
                            {service.has_blood_bank && (
                                <View style={styles.bloodBankBadge}>
                                    <SafeIcon name="droplet" size={16} color="#DC2626" type="lucide" />
                                    <Text style={styles.bloodBankText}>{t('hopitalDetails.banqueSang')}</Text>
                                </View>
                            )}
                            {/* Actions rapides */}
                            <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: '#BFDBFE' }}
                                    onPress={() => handleBookAppointment(service)}
                                >
                                    <SafeIcon name="calendar" size={14} color="#3B82F6" type="lucide" />
                                    <Text style={{ marginLeft: 4, fontSize: 12, color: '#3B82F6', fontWeight: '600' }}>{t('hopitalHome.takeRdv')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: '#FCA5A5' }}
                                    onPress={() => {
                                        hapticPress();
                                        hospitalService.getWaitTimes(service.service_id).then((resp: any) => {
                                            const wt = resp?.data?.wait_times || resp?.wait_times;
                                            if (wt && wt.length > 0) {
                                                const avg = wt[0]?.avg_wait_time_minutes || wt[0]?.estimated_wait_minutes || '?';
                                                Alert.alert(t('hopitalHome.waitTime'), t('hopitalHome.avgWaitTime', { minutes: avg }));
                                            } else {
                                                Alert.alert(t('hopitalHome.infoTitle'), t('hopitalHome.waitTimeUnavailable'));
                                            }
                                        }).catch(() => Alert.alert(t('hopitalHome.infoTitle'), t('hopitalHome.waitTimeServiceDown')));
                                    }}
                                >
                                    <SafeIcon name="clock" size={14} color="#EF4444" type="lucide" />
                                    <Text style={{ marginLeft: 4, fontSize: 12, color: '#EF4444', fontWeight: '600' }}>{t('hopitalHome.waitShort')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <View style={styles.content}>
                    <Text style={styles.placeholderText}>
                        {t('hopitalHome.placeholderSearchOrAi')}
                    </Text>
                    {useAvailability && location?.coords && (
                        <TouchableOpacity
                            style={styles.searchAvailableButton}
                            onPress={() => loadAvailableServices()}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchAvailableButtonText}>
                                {t('hopitalHome.searchAvailableServicesNow')}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Modal de tri */}
            <SortModal
                visible={showSortModal}
                onClose={() => setShowSortModal(false)}
                sortBy={sortBy}
                onSortChange={setSortBy}
                sortOptions={sortOptions}
            />

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
                    onPickImage={showImageSourcePicker}
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
    onPickImage: () => void;
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
    onPickImage,
}) => {
    const { t } = useLanguageSafe();

    const urgencyLabel = (level: string | undefined) => {
        switch (level) {
            case 'critical':
                return t('hopitalHome.urgencyCritical');
            case 'high':
                return t('hopitalHome.urgencyHigh');
            case 'moderate':
                return t('hopitalHome.urgencyModerate');
            default:
                return t('hopitalHome.urgencyLow');
        }
    };

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
                            {mode === 'pathology' ? t('hopitalHome.pathologyModalTitle') : t('hopitalHome.imageModalTitle')}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <KeyboardAwareScreen
                        style={styles.modalScroll}
                        contentContainerStyle={styles.modalScrollContent}
                    >
                        {mode === 'pathology' ? (
                            <>
                                <View style={styles.pathologySearchContainer}>
                                    <Text style={styles.pathologySearchTitle}>
                                        {t('hopitalHome.pathologyModalHeading')}
                                    </Text>
                                    <Text style={styles.pathologySearchSubtitle}>
                                        {t('hopitalHome.pathologyModalSubtitle')}
                                    </Text>

                                    <View style={styles.pathologyInputContainer}>
                                        <View style={styles.pathologySearchBar}>
                                            <TextInput
                                                style={styles.pathologyInput}
                                                placeholder={t('hopitalHome.pathologyPlaceholder')}
                                                placeholderTextColor="#9CA3AF"
                                                value={pathologyQuery}
                                                onChangeText={onPathologyQueryChange}
                                                multiline
                                                numberOfLines={4}
                                                textAlignVertical="top"
                                                editable={!loading}
                                                returnKeyType="search"
                                                onSubmitEditing={onSearchPathology}
                                            />
                                            <TouchableOpacity
                                                style={[
                                                    styles.pathologySearchButton,
                                                    (!pathologyQuery.trim() || loading) && styles.pathologySearchButtonDisabled
                                                ]}
                                                onPress={onSearchPathology}
                                                disabled={!pathologyQuery.trim() || loading}
                                                activeOpacity={0.7}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                                ) : (
                                                    <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[
                                            styles.searchButton,
                                            (!pathologyQuery.trim() || loading) && styles.searchButtonDisabled
                                        ]}
                                        onPress={onSearchPathology}
                                        disabled={!pathologyQuery.trim() || loading}
                                        activeOpacity={0.7}
                                    >
                                        {loading ? (
                                            <>
                                                <ActivityIndicator color="#FFFFFF" size="small" />
                                                <Text style={styles.searchButtonText}>{t('hopitalHome.analyzing')}</Text>
                                            </>
                                        ) : (
                                            <>
                                                <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                                                <Text style={styles.searchButtonText}>{t('hopitalHome.analyzeWithAi')}</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    {!pathologyQuery.trim() && (
                                        <Text style={styles.pathologyHint}>
                                            {t('hopitalHome.pathologyExamplesHint')}
                                        </Text>
                                    )}
                                </View>

                                {pathologyResults.length > 0 && (
                                    <View style={styles.resultsContainer}>
                                        <View style={styles.resultsHeader}>
                                            <SafeIcon name="check-circle" size={20} color="#DC2626" type="lucide" />
                                            <Text style={styles.resultsHeaderText}>
                                                {t('hopitalHome.resultsFound', { count: pathologyResults.length })}
                                            </Text>
                                        </View>
                                        {pathologyResults.map((result, index) => (
                                            <View key={index} style={styles.pathologyCard}>
                                                <View style={styles.pathologyHeader}>
                                                    <Text style={styles.pathologyName}>{String(result.pathology_name || '')}</Text>
                                                    {result.urgency_level && (
                                                        <View style={[styles.urgencyBadge, styles[`urgency${String(result.urgency_level).charAt(0).toUpperCase() + String(result.urgency_level).slice(1)}`]]}>
                                                            <Text style={styles.urgencyText}>
                                                                {urgencyLabel(result.urgency_level)}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                {result.description && (
                                                    <Text style={styles.pathologyDescription}>{String(result.description)}</Text>
                                                )}

                                                {result.symptoms && Array.isArray(result.symptoms) && result.symptoms.length > 0 && (
                                                    <View style={styles.symptomsContainer}>
                                                        <Text style={styles.symptomsTitle}>{t('hopitalHome.symptomsLabel')}</Text>
                                                        {result.symptoms
                                                            .filter(s => s != null)
                                                            .map((symptom, i) => (
                                                                <Text key={i} style={styles.symptomItem}>• {String(symptom)}</Text>
                                                            ))}
                                                    </View>
                                                )}

                                                {result.recommended_services && Array.isArray(result.recommended_services) && result.recommended_services.length > 0 && (
                                                    <View style={styles.servicesContainer}>
                                                        <Text style={styles.servicesTitle}>{t('hopitalHome.recommendedServicesLabel')}</Text>
                                                        {result.recommended_services
                                                            .filter(s => s != null)
                                                            .map((service, i) => (
                                                                <Text key={i} style={styles.serviceItem}>• {String(service)}</Text>
                                                            ))}
                                                    </View>
                                                )}

                                                {result.recommended_examinations && Array.isArray(result.recommended_examinations) && result.recommended_examinations.length > 0 && (
                                                    <View style={styles.examsContainer}>
                                                        <Text style={styles.examsTitle}>{t('hopitalHome.recommendedExamsLabel')}</Text>
                                                        {result.recommended_examinations
                                                            .filter(e => e != null)
                                                            .map((exam, i) => (
                                                                <Text key={i} style={styles.examItem}>• {String(exam)}</Text>
                                                            ))}
                                                    </View>
                                                )}

                                                {result.hospitals_suggested && Array.isArray(result.hospitals_suggested) && result.hospitals_suggested.length > 0 && (
                                                    <View style={styles.hospitalsContainer}>
                                                        <Text style={styles.hospitalsTitle}>{t('hopitalHome.hospitalsSuggestedLabel')}</Text>
                                                        {result.hospitals_suggested.map((hospital, i) => (
                                                            <View key={i} style={styles.hospitalItem}>
                                                                {hospital.hospital_name && (
                                                                    <Text style={styles.hospitalName}>{String(hospital.hospital_name)}</Text>
                                                                )}
                                                                {hospital.speciality && (
                                                                    <Text style={styles.hospitalSpeciality}>{String(hospital.speciality)}</Text>
                                                                )}
                                                                {hospital.distance_km != null && (
                                                                    <Text style={styles.hospitalDistance}>
                                                                        {t('hopitalHome.atDistanceKm', { distance: Number(hospital.distance_km).toFixed(1) })}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}

                                                {result.recommendations && Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
                                                    <View style={styles.recommendationsContainer}>
                                                        <Text style={styles.recommendationsTitle}>{t('hopitalHome.recommendationsColon')}</Text>
                                                        {result.recommendations
                                                            .filter(r => r != null)
                                                            .map((rec, i) => (
                                                                <Text key={i} style={styles.recommendationItem}>• {String(rec)}</Text>
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
                                        <ActivityIndicator size="large" color="#DC2626" />
                                        <Text style={styles.loadingText}>{t('hopitalHome.analyzing')}</Text>
                                    </View>
                                ) : imageAnalysis ? (
                                    <View style={styles.analysisContainer}>
                                        <View style={styles.analysisHeader}>
                                            <SafeIcon name="check-circle" size={24} color="#DC2626" type="lucide" />
                                            <Text style={styles.analysisTitle}>{t('hopitalHome.rapportDanalyseIa')}</Text>
                                        </View>

                                        {imageAnalysis.description && (
                                            <View style={styles.analysisSection}>
                                                <Text style={styles.analysisSectionTitle}>{t('hopitalHome.labelDescription')}</Text>
                                                <Text style={styles.analysisText}>{String(imageAnalysis.description)}</Text>
                                            </View>
                                        )}

                                        {imageAnalysis.interpretation && (
                                            <View style={styles.analysisSection}>
                                                <Text style={styles.analysisSectionTitle}>{t('hopitalHome.interpretation')}</Text>
                                                <Text style={styles.analysisText}>{String(imageAnalysis.interpretation)}</Text>
                                            </View>
                                        )}

                                        {imageAnalysis.tags && Array.isArray(imageAnalysis.tags) && imageAnalysis.tags.length > 0 && (
                                            <View style={styles.analysisSection}>
                                                <Text style={styles.analysisSectionTitle}>{t('hopitalHome.elementsDetectes')}</Text>
                                                <View style={styles.tagsContainer}>
                                                    {imageAnalysis.tags
                                                        .filter(t => t != null)
                                                        .map((tag, index) => (
                                                            <View key={index} style={styles.tag}>
                                                                <Text style={styles.tagText}>{String(tag)}</Text>
                                                            </View>
                                                        ))}
                                                </View>
                                            </View>
                                        )}

                                        {imageAnalysis.recommendations && Array.isArray(imageAnalysis.recommendations) && imageAnalysis.recommendations.length > 0 && (
                                            <View style={styles.analysisSection}>
                                                <Text style={styles.analysisSectionTitle}>{t('hopitalHome.recommendationsTitleShort')}</Text>
                                                {imageAnalysis.recommendations
                                                    .filter(r => r != null)
                                                    .map((rec, index) => (
                                                        <View key={index} style={styles.recommendationItem}>
                                                            <SafeIcon name="check" size={16} color="#DC2626" type="lucide" />
                                                            <Text style={styles.recommendationText}>{String(rec)}</Text>
                                                        </View>
                                                    ))}
                                            </View>
                                        )}

                                        {imageAnalysis.confidence != null && (
                                            <View style={styles.confidenceContainer}>
                                                <Text style={styles.confidenceLabel}>
                                                    {t('hopitalHome.confidencePercent', { percent: Math.round(Number(imageAnalysis.confidence) * 100) })}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                ) : selectedImage ? (
                                    <View style={styles.emptyAnalysisContainer}>
                                        <ActivityIndicator size="large" color="#DC2626" />
                                        <Text style={styles.placeholderText}>
                                            {t('hopitalHome.analyzing')}
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.emptyAnalysisContainer}>
                                        <SafeIcon name="image" size={48} color="#9CA3AF" type="lucide" />
                                        <Text style={styles.placeholderText}>
                                            {t('hopitalHome.selectImageAnalyzePrompt')}
                                        </Text>
                                        <Text style={styles.placeholderSubtext}>
                                            {t('hopitalHome.photoOrGalleryHint')}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.searchButton}
                                            onPress={onPickImage}
                                        >
                                            <SafeIcon name="camera" size={18} color="#FFFFFF" type="lucide" />
                                            <Text style={styles.searchButtonText}>{t('hopitalHome.selectionnerUneImage')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}
                    </KeyboardAwareScreen>
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
        maxHeight: 80, // ✅ Limite la hauteur pour les retours à la ligne
        minHeight: 44, // ✅ Hauteur minimum pour un seul ligne
        paddingVertical: 8, // ✅ Espacement vertical pour multiline
    },
    clearButton: {
        padding: 4,
    },
    searchButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#059669',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    searchButtonDisabled: {
        backgroundColor: '#D1D5DB',
        opacity: 0.5,
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
        color: '#DC2626',
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
    pathologySearchContainer: {
        marginBottom: 20,
    },
    pathologySearchTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    pathologySearchSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 20,
    },
    pathologyInputContainer: {
        marginBottom: 16,
    },
    pathologySearchBar: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    pathologyInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
        minHeight: 100, // ✅ Hauteur minimale pour permettre une bonne saisie
        maxHeight: 200,
        paddingVertical: 8,
        textAlignVertical: 'top',
    },
    pathologySearchButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4, // Aligner avec le texte
    },
    pathologySearchButtonDisabled: {
        backgroundColor: '#D1D5DB',
        opacity: 0.5,
    },
    pathologyHint: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 12,
        fontStyle: 'italic',
    },
    mainSearchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#DC2626',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        gap: 8,
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    mainSearchButtonDisabled: {
        backgroundColor: '#D1D5DB',
        shadowOpacity: 0,
        elevation: 0,
    },
    searchButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    resultsContainer: {
        gap: 12,
        marginTop: 8,
    },
    resultsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    resultsHeaderText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    pathologyCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#DC2626',
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
        color: '#DC2626',
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
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
    },
    analysisHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    analysisTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    analysisSection: {
        marginBottom: 20,
    },
    analysisSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    analysisText: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: '#FEE2E2',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    tagText: {
        fontSize: 12,
        color: '#DC2626',
        fontWeight: '600',
    },
    recommendationItemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    recommendationText: {
        flex: 1,
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    confidenceContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    confidenceLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },
    emptyAnalysisContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    placeholderSubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 8,
    },
    interpretation: {
        fontSize: 16,
        color: '#111827',
        lineHeight: 24,
        marginBottom: 16,
    },
    // Styles pour tri
    actionsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sortButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    sortModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sortModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 8,
        minWidth: 280,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    sortOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
        borderRadius: 8,
    },
    sortOptionActive: {
        backgroundColor: '#FEE2E2',
    },
    sortOptionText: {
        flex: 1,
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    sortOptionTextActive: {
        color: '#DC2626',
        fontWeight: '600',
    },
    contentContainer: {
        padding: 16,
    },
    availabilityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    availabilityHeaderText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    serviceCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    serviceCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    badge24h: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badge24hText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#DC2626',
    },
    servicesList: {
        marginTop: 8,
    },
    servicesListTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    serviceItemAvail: {
        fontSize: 13,
        color: '#6B7280',
        marginLeft: 4,
    },
    distanceText: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 4,
    },
    serviceItemMore: {
        fontSize: 12,
        color: '#9CA3AF',
        fontStyle: 'italic',
        marginTop: 4,
    },
    bloodBankBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    bloodBankText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    searchAvailableButton: {
        backgroundColor: '#DC2626',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
        marginTop: 12,
    },
    searchAvailableButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

// Modal de tri
interface SortModalProps {
    visible: boolean;
    onClose: () => void;
    sortBy: SortOption;
    onSortChange: (sort: SortOption) => void;
    sortOptions: { value: SortOption; label: string; icon: string }[];
}

const SortModal: React.FC<SortModalProps> = ({
    visible,
    onClose,
    sortBy,
    onSortChange,
    sortOptions,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.sortModalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.sortModalContent}>
                    {sortOptions.map((option) => (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.sortOption,
                                sortBy === option.value && styles.sortOptionActive,
                            ]}
                            onPress={() => {
                                hapticPress();
                                onSortChange(option.value);
                                onClose();
                            }}
                        >
                            <SafeIcon
                                name={option.icon}
                                size={20}
                                color={sortBy === option.value ? '#DC2626' : '#6B7280'}
                                type="lucide"
                            />
                            <Text
                                style={[
                                    styles.sortOptionText,
                                    sortBy === option.value && styles.sortOptionTextActive,
                                ]}
                            >
                                {option.label}
                            </Text>
                            {sortBy === option.value && (
                                <SafeIcon name="check" size={20} color="#DC2626" type="lucide" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default HopitalHomeScreen;

