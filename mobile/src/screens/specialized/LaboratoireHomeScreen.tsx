// ✅ Écran Laboratoire MODERNE - Refonte complète avec UX de niveau mondial
// ÉTAPE 1: Structure de base avec autocomplete et fonctionnalités IA

import { useNavigation } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
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
import { ExaminationType, LabAnalysisResult, laboratoryService, PathologySearchResult } from '../../services/laboratoryService';
import { hapticPress } from '../../utils/hapticFeedback';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'distance_asc' | 'name_asc';

const LaboratoireHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();
    const toaster = useToaster();

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [examinations, setExaminations] = useState<ExaminationType[]>([]);
    const [availableLaboratories, setAvailableLaboratories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useAvailability, setUseAvailability] = useState(true); // Utiliser le système de disponibilité par défaut

    // États autocomplete
    const [autocompleteQuery, setAutocompleteQuery] = useState('');
    const [autocompleteResults, setAutocompleteResults] = useState<ExaminationType[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [selectedExamination, setSelectedExamination] = useState<ExaminationType | null>(null);

    // États IA
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiMode, setAiMode] = useState<'pathology' | 'image' | null>(null);
    const [pathologyQuery, setPathologyQuery] = useState('');
    const [pathologyResults, setPathologyResults] = useState<PathologySearchResult[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageAnalysis, setImageAnalysis] = useState<LabAnalysisResult | null>(null);

    // États de tri
    const [sortBy, setSortBy] = useState<SortOption>('relevance');
    const [showSortModal, setShowSortModal] = useState(false);

    // Options de tri
    const sortOptions: { value: SortOption; label: string; icon: string }[] = [
        { value: 'relevance', label: 'Pertinence', icon: 'star' },
        { value: 'price_asc', label: 'Prix croissant', icon: 'arrow-up' },
        { value: 'price_desc', label: 'Prix décroissant', icon: 'arrow-down' },
        { value: 'distance_asc', label: 'Plus proche', icon: 'map-pin' },
        { value: 'name_asc', label: 'Nom (A-Z)', icon: 'type' },
    ];

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
            const response = await laboratoryService.searchExaminationTypes(query, 10);
            const r = response.data as any;
            if (response.success && r?.examinations) {
                setAutocompleteResults(r.examinations);
                setShowAutocomplete(true);
            }
        } catch (err: any) {
            console.error('[LaboratoireHomeScreen] Erreur autocomplete:', err);
        }
    };

    // ✅ NOUVEAU: Fonction de recherche principale
    const handleSearch = () => {
        hapticPress();
        if (!searchQuery.trim() && !autocompleteQuery.trim()) {
            // Si pas de recherche, charger tous les laboratoires disponibles
            loadAvailableLaboratories();
            return;
        }

        const query = searchQuery.trim() || autocompleteQuery.trim();
        setShowAutocomplete(false);

        // Rechercher les laboratoires disponibles avec système de disponibilité
        if (useAvailability && location?.coords) {
            loadAvailableLaboratories(query);
        } else {
            // Navigation vers recherche de laboratoires avec ce type d'examen
            navigation.navigate('LaboratoireList' as never, {
                examinationType: query
            } as never);
        }
    };

    const handleExaminationSelect = (examination: ExaminationType) => {
        hapticPress();
        setSelectedExamination(examination);
        setSearchQuery(examination.name);
        setAutocompleteQuery(examination.name);
        setShowAutocomplete(false);

        // Rechercher les laboratoires disponibles avec système de disponibilité
        if (useAvailability && location?.coords) {
            loadAvailableLaboratories(examination.name);
        } else {
            // Navigation vers recherche de laboratoires avec ce type d'examen
            navigation.navigate('LaboratoireList' as never, {
                examinationType: examination.name
            } as never);
        }
    };

    // Charger les laboratoires disponibles avec système de disponibilité
    const loadAvailableLaboratories = async (examinationName?: string) => {
        try {
            setLoading(true);
            setError(null);

            const response = await laboratoryService.searchWithAvailability(
                examinationName || searchQuery || 'laboratoire',
                location?.coords ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : undefined,
                50 // 50km par défaut
            );

            const r = response.data as any;
            if (response.success && r?.results) {
                setAvailableLaboratories(r.results);
            } else {
                setAvailableLaboratories([]);
            }
        } catch (err: any) {
            console.error('[LaboratoireHomeScreen] Erreur chargement disponibilité:', err);
            setError('Erreur lors du chargement des laboratoires disponibles');
            setAvailableLaboratories([]);
        } finally {
            setLoading(false);
        }
    };

    // ✅ CORRIGÉ: Fonction de recherche de pathologie avec toast et modal fonctionnel
    const handleSearchPathology = async () => {
        if (!pathologyQuery.trim()) {
            toaster.warning('Veuillez entrer une recherche de pathologie');
            return;
        }

        hapticPress();
        setLoadingAI(true);
        setAiMode('pathology');
        setShowAIModal(true); // ✅ Ouvrir le modal avant la recherche
        setPathologyResults([]); // Réinitialiser les résultats

        try {
            const response = await laboratoryService.searchPathology(pathologyQuery.trim());

            // Gérer différents formats de réponse
            if (response.success) {
                const r = response.data as any;
                const results = r?.results || r || [];
                if (Array.isArray(results) && results.length > 0) {
                    setPathologyResults(results);
                    toaster.success(`${results.length} pathologie(s) trouvée(s)`);
                } else {
                    toaster.warning('Aucune pathologie trouvée. Essayez avec d\'autres symptômes.');
                    setPathologyResults([]);
                }
            } else {
                const r = response.data as any;
                const errorMsg = r?.message || response.error || 'L\'IA de recherche pathologique n\'est pas encore opérationnelle.';
                toaster.error(errorMsg);
                setPathologyResults([]);
            }
        } catch (err: any) {
            console.error('[LaboratoireHomeScreen] Erreur recherche pathologie:', err);
            const errorMsg = err.message || err.error || 'Erreur lors de la recherche. L\'IA de recherche pathologique n\'est peut-être pas encore opérationnelle.';
            toaster.error(errorMsg);
            setPathologyResults([]);
        } finally {
            setLoadingAI(false);
        }
    };

    const handlePickImage = async (source: 'camera' | 'gallery') => {
        hapticPress();

        try {
            let result;

            if (source === 'camera') {
                const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
                if (cameraStatus !== 'granted') {
                    Alert.alert(t('labHome.permissionRequired'), t('labHome.allowCamera'));
                    return;
                }

                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.8,
                    base64: false, // ✅ CORRIGÉ: Ne pas demander base64 directement, on va convertir
                });
            } else {
                const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (galleryStatus !== 'granted') {
                    Alert.alert(t('labHome.permissionRequired'), t('labHome.allowGallery'));
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
                await analyzeImage(base64Image);
            }
        } catch (err: any) {
            console.error('[LaboratoireHomeScreen] Erreur sélection image:', err);
            toaster.error(err.message || 'Erreur lors de la sélection de l\'image');
            setLoadingAI(false);
            setImageAnalysis(null);
        }
    };

    const showImageSourcePicker = () => {
        Alert.alert(
            t('labHome.chooseSource'),
            t('labHome.chooseSourceMsg'),
            [
                {
                    text: 'Caméra',
                    onPress: () => handlePickImage('camera'),
                },
                {
                    text: 'Galerie',
                    onPress: () => handlePickImage('gallery'),
                },
                {
                    text: 'Annuler',
                    style: 'cancel',
                },
            ]
        );
    };

    const analyzeImage = async (imageBase64: string) => {
        setLoadingAI(true);
        setAiMode('image');
        setShowAIModal(true);

        try {
            const response = await laboratoryService.analyzeExaminationImage(
                imageBase64,
                selectedExamination?.name || 'Analyse générale',
                undefined,
                undefined
            );

            // Gérer différents formats de réponse
            if (response.success) {
                const r = response.data as any;
                const analysis = r?.analysis || r;
                if (analysis) {
                    setImageAnalysis(analysis);
                    toaster.success('Analyse d\'image terminée');
                } else {
                    const errorMsg = 'Impossible d\'analyser l\'image. L\'IA d\'analyse d\'images n\'est peut-être pas encore opérationnelle.';
                    toaster.error(errorMsg);
                    setImageAnalysis(null);
                }
            } else {
                const r = response.data as any;
                const errorMsg = r?.message || response.error || 'Impossible d\'analyser l\'image. L\'IA d\'analyse d\'images n\'est peut-être pas encore opérationnelle.';
                toaster.error(errorMsg);
                setImageAnalysis(null);
            }
        } catch (err: any) {
            console.error('[LaboratoireHomeScreen] Erreur analyse image:', err);
            const errorMsg = err.message || err.error || 'Erreur lors de l\'analyse. L\'IA d\'analyse d\'images n\'est peut-être pas encore opérationnelle.';
            toaster.error(errorMsg);
            setImageAnalysis(null);
        } finally {
            setLoadingAI(false);
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec recherche */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#60A5FA', '#93C5FD']}
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
                            <Text style={styles.headerTitle}>Laboratoires</Text>
                            <Text style={styles.headerSubtitle}>Recherche d'examens</Text>
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
                                placeholder="Rechercher un examen (ex: Hémogramme, Glycémie...)"
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
                            {/* Bouton de recherche */}
                            <TouchableOpacity
                                style={[styles.headerSearchButton, (!searchQuery.trim() && !autocompleteQuery.trim()) && styles.headerSearchButtonDisabled]}
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
                                            onPress={() => handleExaminationSelect(item)}
                                        >
                                            <SafeIcon name="flask" size={18} color="#2563EB" type="lucide" />
                                            <View style={styles.autocompleteItemText}>
                                                <Text style={styles.autocompleteItemName}>{item.name}</Text>
                                                {item.category && (
                                                    <Text style={styles.autocompleteItemCategory}>{item.category}</Text>
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
                            {sortOptions.find(o => o.value === sortBy)?.label || 'Trier'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Contenu principal */}
            {loading && availableLaboratories.length === 0 ? (
                <View style={styles.content}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.placeholderText}>Recherche des laboratoires disponibles...</Text>
                </View>
            ) : availableLaboratories.length > 0 ? (
                <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                    <View style={styles.availabilityHeader}>
                        <SafeIcon name="check-circle" size={20} color="#2563EB" type="lucide" />
                        <Text style={styles.availabilityHeaderText}>
                            {availableLaboratories.length} laboratoire{availableLaboratories.length > 1 ? 's' : ''} disponible{availableLaboratories.length > 1 ? 's' : ''} maintenant
                        </Text>
                    </View>
                    {availableLaboratories.map((lab, index) => {
                        const productData = lab.product_data || {};
                        const labName = productData.titre_service?.valeur || productData.nom || `Laboratoire ${lab.service_id}`;
                        const availableExams = productData.examensDisponibles || productData.examinations || [];
                        const is24h = productData.planningHebdomadaire?.permanent || false;

                        return (
                            <View key={lab.service_id || index} style={styles.labCard}>
                                <View style={styles.labCardHeader}>
                                    <Text style={styles.labCardTitle}>{labName}</Text>
                                    {is24h && (
                                        <View style={styles.badge24h}>
                                            <Text style={styles.badge24hText}>24h/24</Text>
                                        </View>
                                    )}
                                    {lab.is_available_now && (
                                        <View style={styles.availableBadge}>
                                            <SafeIcon name="check-circle" size={14} color="#10B981" type="lucide" />
                                            <Text style={styles.availableBadgeText}>Disponible</Text>
                                        </View>
                                    )}
                                </View>
                                {lab.availability_info && (
                                    <Text style={styles.availabilityInfo}>{lab.availability_info}</Text>
                                )}
                                {Array.isArray(availableExams) && availableExams.length > 0 && (
                                    <View style={styles.examsList}>
                                        <Text style={styles.examsListTitle}>Examens disponibles :</Text>
                                        {availableExams.slice(0, 5).map((exam: string, i: number) => (
                                            <Text key={i} style={styles.examItem}>• {exam}</Text>
                                        ))}
                                        {availableExams.length > 5 && (
                                            <Text style={styles.examItemMore}>
                                                +{availableExams.length - 5} autres
                                            </Text>
                                        )}
                                    </View>
                                )}
                                {lab.distance_km !== undefined && (
                                    <Text style={styles.distanceText}>
                                        📍 {lab.distance_km.toFixed(1)} km
                                    </Text>
                                )}
                                {/* Actions rapides */}
                                <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                                    <TouchableOpacity
                                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: '#BFDBFE' }}
                                        onPress={() => {
                                            hapticPress();
                                            Alert.alert(
                                                t('labHome.bookExam'),
                                                t('labHome.bookExamConfirm', { lab: labName }),
                                                [
                                                    { text: 'Annuler', style: 'cancel' },
                                                    {
                                                        text: 'Réserver',
                                                        onPress: async () => {
                                                            try {
                                                                const resp = await laboratoryService.searchExaminationTypes(searchQuery || 'analyse', 1);
                                                                Alert.alert(t('message.success'), t('labHome.bookingRequestSent'));
                                                            } catch (e) {
                                                                Alert.alert(t('labHome.info'), t('labHome.bookingSoonAvailable'));
                                                            }
                                                        },
                                                    },
                                                ]
                                            );
                                        }}
                                    >
                                        <SafeIcon name="calendar" size={14} color="#3B82F6" type="lucide" />
                                        <Text style={{ marginLeft: 4, fontSize: 12, color: '#3B82F6', fontWeight: '600' }}>Réserver</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0FDF4', borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: '#BBF7D0' }}
                                        onPress={() => {
                                            hapticPress();
                                            laboratoryService.getLaboratoryExaminationTypes(lab.service_id).then((resp: any) => {
                                                const r = resp.data as any;
                                                const types = r?.data || r || [];
                                                if (Array.isArray(types) && types.length > 0) {
                                                    const list = types.slice(0, 8).map((t: any) => `• ${t.name || t}`).join('\n');
                                                    Alert.alert(t('labHome.examTypes'), list);
                                                } else {
                                                    Alert.alert(t('labHome.info'), t('labHome.examListUnavailable'));
                                                }
                                            }).catch(() => Alert.alert(t('labHome.info'), t('labHome.serviceUnavailable')));
                                        }}
                                    >
                                        <SafeIcon name="list" size={14} color="#16A34A" type="lucide" />
                                        <Text style={{ marginLeft: 4, fontSize: 12, color: '#16A34A', fontWeight: '600' }}>Examens</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            ) : (
                <View style={styles.content}>
                    <Text style={styles.placeholderText}>
                        Recherchez un examen ou utilisez les fonctionnalités IA
                    </Text>
                    {useAvailability && location?.coords && (
                        <TouchableOpacity
                            style={styles.searchAvailableButton}
                            onPress={() => loadAvailableLaboratories()}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchAvailableButtonText}>
                                Rechercher les laboratoires disponibles maintenant
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

            {/* Modal IA - À compléter */}
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

// Modal IA - À compléter dans les prochaines étapes
interface AIModalProps {
    visible: boolean;
    onClose: () => void;
    mode: 'pathology' | 'image' | null;
    pathologyQuery: string;
    onPathologyQueryChange: (text: string) => void;
    onSearchPathology: () => void;
    pathologyResults: PathologySearchResult[];
    imageAnalysis: LabAnalysisResult | null;
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

                    <KeyboardAwareScreen
                        style={styles.modalScroll}
                        contentContainerStyle={styles.modalScrollContent}
                    >
                        {mode === 'pathology' ? (
                            <>
                                <View style={styles.pathologySearchContainer}>
                                    <Text style={styles.pathologySearchTitle}>
                                        Recherche Pathologie IA
                                    </Text>
                                    <Text style={styles.pathologySearchSubtitle}>
                                        Décrivez vos symptômes ou recherchez une pathologie pour obtenir des recommandations d'examens
                                    </Text>

                                    <View style={styles.pathologyInputContainer}>
                                        <View style={styles.pathologySearchBar}>
                                            <TextInput
                                                style={styles.pathologyInput}
                                                placeholder="Ex: Maux de tête, fièvre, douleurs abdominales..."
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
                                                <Text style={styles.searchButtonText}>Analyse en cours...</Text>
                                            </>
                                        ) : (
                                            <>
                                                <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                                                <Text style={styles.searchButtonText}>Analyser avec l'IA</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    {!pathologyQuery.trim() && (
                                        <Text style={styles.pathologyHint}>
                                            💡 Exemples : "Douleurs thoraciques", "Fièvre persistante", "Troubles digestifs"
                                        </Text>
                                    )}
                                </View>

                                {pathologyResults.length > 0 && (
                                    <View style={styles.resultsContainer}>
                                        <View style={styles.resultsHeader}>
                                            <SafeIcon name="check-circle" size={20} color="#2563EB" type="lucide" />
                                            <Text style={styles.resultsHeaderText}>
                                                {pathologyResults.length} résultat{pathologyResults.length > 1 ? 's' : ''} trouvé{pathologyResults.length > 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                        {pathologyResults.map((result, index) => (
                                            <View key={index} style={styles.pathologyCard}>
                                                <Text style={styles.pathologyName}>{result.pathology_name}</Text>
                                                <Text style={styles.pathologyDescription}>{result.description}</Text>
                                                {result.recommended_examinations.length > 0 && (
                                                    <View style={styles.examsContainer}>
                                                        <Text style={styles.examsTitle}>Examens recommandés:</Text>
                                                        {result.recommended_examinations.map((exam, i) => (
                                                            <Text key={i} style={styles.examItem}>• {exam}</Text>
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
                                    <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
                                )}
                                {loading ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="large" color="#2563EB" />
                                        <Text style={styles.loadingText}>Analyse en cours...</Text>
                                    </View>
                                ) : imageAnalysis ? (
                                    <View style={styles.analysisContainer}>
                                        <Text style={styles.analysisTitle}>Résultats de l'analyse</Text>
                                        <Text style={styles.interpretation}>{String(imageAnalysis.interpretation || 'Aucune interprétation disponible')}</Text>
                                        {Array.isArray(imageAnalysis.anomalies_detected) && imageAnalysis.anomalies_detected.length > 0 && (
                                            <View style={styles.anomaliesContainer}>
                                                <Text style={styles.anomaliesTitle}>Anomalies détectées:</Text>
                                                {imageAnalysis.anomalies_detected.map((anomaly, i) => (
                                                    <View key={i} style={styles.anomalyCard}>
                                                        <Text style={styles.anomalyParameter}>{String(anomaly.parameter || 'Paramètre inconnu')}</Text>
                                                        <Text style={styles.anomalyValue}>{String(anomaly.value || 'Valeur inconnue')}</Text>
                                                        <Text style={styles.anomalyDescription}>{String(anomaly.description || 'Aucune description')}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        {Array.isArray(imageAnalysis.recommendations) && imageAnalysis.recommendations.length > 0 && (
                                            <View style={styles.recommendationsContainer}>
                                                <Text style={styles.recommendationsTitle}>Recommandations:</Text>
                                                {imageAnalysis.recommendations.map((rec, i) => (
                                                    <Text key={i} style={styles.recommendationItem}>• {String(rec)}</Text>
                                                ))}
                                            </View>
                                        )}
                                        {Array.isArray(imageAnalysis.follow_up_exams) && imageAnalysis.follow_up_exams.length > 0 && (
                                            <View style={styles.followUpContainer}>
                                                <Text style={styles.followUpTitle}>Examens complémentaires suggérés:</Text>
                                                {imageAnalysis.follow_up_exams.map((exam, i) => (
                                                    <Text key={i} style={styles.followUpItem}>• {String(exam)}</Text>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                ) : selectedImage ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="large" color="#2563EB" />
                                        <Text style={styles.loadingText}>Analyse en cours...</Text>
                                    </View>
                                ) : (
                                    <View style={styles.emptyAnalysisContainer}>
                                        <SafeIcon name="image" size={48} color="#9CA3AF" type="lucide" />
                                        <Text style={styles.placeholderText}>
                                            Sélectionnez une image pour l'analyser avec l'IA
                                        </Text>
                                        <Text style={styles.placeholderSubtext}>
                                            Prenez une photo ou choisissez depuis votre galerie
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.searchButton}
                                            onPress={onPickImage}
                                        >
                                            <SafeIcon name="camera" size={18} color="#FFFFFF" type="lucide" />
                                            <Text style={styles.searchButtonText}>Sélectionner une image</Text>
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
    headerSearchButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#059669',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    headerSearchButtonDisabled: {
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
        backgroundColor: '#2563EB',
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
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        gap: 8,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    searchButtonDisabled: {
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
    },
    pathologyName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    pathologyDescription: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 12,
    },
    examsContainer: {
        marginTop: 12,
    },
    examsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    previewImage: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        marginBottom: 20,
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
    anomaliesContainer: {
        marginTop: 16,
    },
    anomaliesTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    anomalyCard: {
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    anomalyParameter: {
        fontSize: 16,
        fontWeight: '700',
        color: '#92400E',
        marginBottom: 4,
    },
    anomalyValue: {
        fontSize: 14,
        color: '#92400E',
        marginBottom: 4,
    },
    anomalyDescription: {
        fontSize: 14,
        color: '#92400E',
    },
    recommendationsContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    recommendationsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    recommendationItem: {
        fontSize: 14,
        color: '#1E40AF',
        lineHeight: 20,
        marginBottom: 4,
    },
    followUpContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
    },
    followUpTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    followUpItem: {
        fontSize: 14,
        color: '#166534',
        lineHeight: 20,
        marginBottom: 4,
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
        backgroundColor: '#EFF6FF',
    },
    sortOptionText: {
        flex: 1,
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    sortOptionTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },
    // Styles pour laboratoires disponibles
    contentContainer: {
        padding: 16,
    },
    availabilityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    availabilityHeaderText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    labCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    labCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 8,
    },
    labCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
        minWidth: '60%',
    },
    badge24h: {
        backgroundColor: '#DBEAFE',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badge24hText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#2563EB',
    },
    availableBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#D1FAE5',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    availableBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669',
    },
    availabilityInfo: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 12,
        fontStyle: 'italic',
    },
    examsList: {
        marginBottom: 12,
    },
    examsListTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    examItem: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
        lineHeight: 20,
    },
    examItemMore: {
        fontSize: 12,
        color: '#9CA3AF',
        fontStyle: 'italic',
        marginTop: 4,
    },
    distanceText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 8,
    },
    searchAvailableButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        gap: 8,
        marginTop: 20,
    },
    searchAvailableButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
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
                                color={sortBy === option.value ? '#2563EB' : '#6B7280'}
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
                                <SafeIcon name="check" size={20} color="#2563EB" type="lucide" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default LaboratoireHomeScreen;

