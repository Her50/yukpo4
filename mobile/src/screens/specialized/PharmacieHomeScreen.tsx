// ✅ Écran Pharmacie MODERNE - Refonte complète avec UX de niveau mondial
// ÉTAPE 1: Structure de base et header

import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
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
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { useLocation } from '../../contexts/LocationContext';
import { pharmacyProductService, PharmacyProduct, ProductSearchFilters } from '../../services/pharmacyProductService';
import { pharmacyService, DosageRecommendation, MedicationInteraction } from '../../services/pharmacyService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { useAIServices } from '../../hooks/useAIServices';
import { imageAnalysisService } from '../../services/imageAnalysisService';
import { useToaster } from '../../components/ToasterProvider';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'distance_asc' | 'name_asc';

const PharmacieHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const toaster = useToaster();

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [medications, setMedications] = useState<PharmacyProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);

    // États UI
    const [sortBy, setSortBy] = useState<SortOption>('relevance');
    const [showFilters, setShowFilters] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);

    // États de filtres
    const [filters, setFilters] = useState<ProductSearchFilters>({
        query: '',
        only_available: true,
        limit: 20,
    });
    const [activeFiltersCount, setActiveFiltersCount] = useState(0);

    // États pour modals IA
    const [selectedMedication, setSelectedMedication] = useState<PharmacyProduct | null>(null);
    const [showDosageModal, setShowDosageModal] = useState(false);
    const [showInteractionsModal, setShowInteractionsModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [dosageData, setDosageData] = useState<DosageRecommendation | null>(null);
    const [interactionsData, setInteractionsData] = useState<MedicationInteraction | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);

    // États pour assistant IA conversationnel
    const { askAI, loading: aiLoading } = useAIServices();
    const [aiQuestion, setAiQuestion] = useState('');
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [showAIChat, setShowAIChat] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [aiChatHeight] = useState(new Animated.Value(0)); // ✅ NOUVEAU: Animation pour le déroulement
    
    // États pour analyse d'image
    const [selectedMedicationImage, setSelectedMedicationImage] = useState<string | null>(null);
    const [imageAnalysisResult, setImageAnalysisResult] = useState<any | null>(null);
    const [analyzingImage, setAnalyzingImage] = useState(false);

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

    // Quick filters
    const quickFilters = [
        { id: 'proche', label: 'Proche de moi', icon: 'map-pin', distance: 10 },
        { id: 'disponible', label: 'Disponibles', icon: 'check-circle', available: true },
        { id: 'prix_bas', label: 'Prix bas', icon: 'tag' },
    ];

    // Initialiser avec localisation GPS
    useEffect(() => {
        if (location?.coords) {
            setFilters(prev => ({
                ...prev,
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                radius_km: 20,
            }));
        }
    }, [location]);

    // Charger les médicaments disponibles à l'ouverture
    useEffect(() => {
        loadMedications(true);
    }, []);

    // Compter les filtres actifs
    useEffect(() => {
        let count = 0;
        if (filters.min_price || filters.max_price) count++;
        if (filters.radius_km && filters.radius_km < 50) count++;
        if (filters.only_available) count++;
        setActiveFiltersCount(count);
    }, [filters]);

    // Charger les médicaments
    const loadMedications = useCallback(async (initialLoad: boolean = false) => {
        try {
            if (initialLoad) {
                setLoading(true);
                setError(null);
            }

            const searchFilters: ProductSearchFilters = {
                ...filters,
                query: searchQuery.trim() || 'médicament', // Par défaut, chercher "médicament" pour afficher des résultats
            };

            const response = await pharmacyProductService.searchProducts(searchFilters);
            
            if (response.success && response.data?.products) {
                let results = response.data.products;
                
                // Limiter à 20 résultats pour l'affichage initial
                if (initialLoad && results.length > 20) {
                    results = results.slice(0, 20);
                }

                // Tri côté client
                if (sortBy !== 'relevance') {
                    results = [...results].sort((a, b) => {
                        switch (sortBy) {
                            case 'price_asc':
                                return (a.prix || 0) - (b.prix || 0);
                            case 'price_desc':
                                return (b.prix || 0) - (a.prix || 0);
                            case 'distance_asc':
                                const distA = a.distance_km || Infinity;
                                const distB = b.distance_km || Infinity;
                                return distA - distB;
                            case 'name_asc':
                                return a.nom_produit.localeCompare(b.nom_produit);
                            default:
                                return 0;
                        }
                    });
                }
                
                setMedications(results);
                setTotalResults(results.length);
            } else {
                setError('Aucun médicament trouvé');
                setMedications([]);
            }
        } catch (err: any) {
            console.error('[PharmacieHomeScreen] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement');
            setMedications([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters, searchQuery, sortBy]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadMedications(false);
    };

    const handleMedicationPress = (medication: PharmacyProduct) => {
        hapticPress();
        setSelectedMedication(medication);
        setShowDetailsModal(true);
    };

    const handleQuickFilter = (filter: typeof quickFilters[0]) => {
        hapticPress();
        if (filter.distance) {
            setFilters(prev => ({
                ...prev,
                radius_km: filter.distance,
            }));
        }
        if (filter.available !== undefined) {
            setFilters(prev => ({
                ...prev,
                only_available: filter.available,
            }));
        }
        if (filter.id === 'prix_bas') {
            setSortBy('price_asc');
        }
        loadMedications(false);
    };

    const clearFilters = () => {
        hapticPress();
        setFilters({
            query: '',
            only_available: true,
            limit: 20,
            lat: location?.coords?.latitude,
            lng: location?.coords?.longitude,
            radius_km: 20,
        });
        setSearchQuery('');
        loadMedications(false);
    };

    const handleSearch = () => {
        hapticPress();
        loadMedications(false);
    };

    // ✅ MODIFIÉ: Fonction pour poser une question à l'IA - maintenant opérationnelle
    const handleAskAI = async () => {
        if (!aiQuestion.trim()) {
            toaster.warning('Veuillez saisir une question');
            return;
        }
        
        hapticPress();
        setAiResponse(null);
        
        try {
            const context = {
                category: 'pharmacie',
                currentSearch: searchQuery,
                medications: medications.slice(0, 5).map(m => m.nom_produit),
                location: location?.coords ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : null
            };
            
            const response = await askAI(aiQuestion, context);
            if (response && response.message) {
                const message = response.message || response.text || response.response || 'Réponse non disponible';
                setAiResponse(message);
                
                // ✅ Mettre à jour les suggestions si fournies
                if (response.suggestions && response.suggestions.length > 0) {
                    setAiSuggestions(response.suggestions);
                }
                
                toaster.success('Réponse IA générée');
            } else {
                const errorMsg = 'Désolé, l\'assistant IA n\'a pas pu traiter votre question. Veuillez réessayer ou consultez votre pharmacien.';
                setAiResponse(errorMsg);
                toaster.error('Impossible d\'obtenir une réponse IA');
            }
        } catch (err: any) {
            console.error('[PharmacieHomeScreen] Erreur IA:', err);
            const errorMsg = err.message || err.error || 'L\'assistant IA n\'est pas encore opérationnel. Veuillez réessayer plus tard.';
            setAiResponse(`Désolé, je n'ai pas pu traiter votre question. ${errorMsg}`);
            toaster.error('Erreur lors de la requête IA');
        }
    };

    // Générer des suggestions IA basées sur la recherche
    useEffect(() => {
        if (searchQuery.length > 3 && medications.length > 0) {
            // Générer des suggestions intelligentes basées sur les résultats
            const suggestions: string[] = [];
            const firstMed = medications[0];
            if (firstMed) {
                suggestions.push(`Quels sont les effets secondaires de ${firstMed.nom_produit}?`);
                suggestions.push(`Comment prendre ${firstMed.nom_produit}?`);
                suggestions.push(`Y a-t-il des interactions avec ${firstMed.nom_produit}?`);
            }
            setAiSuggestions(suggestions);
        } else if (searchQuery.length === 0) {
            // Suggestions générales quand pas de recherche
            setAiSuggestions([
                'Quels médicaments pour la fièvre?',
                'Comment traiter un mal de tête?',
                'Quels sont les médicaments disponibles près de moi?'
            ]);
        } else {
            setAiSuggestions([]);
        }
    }, [searchQuery, medications]);

    // Fonction pour analyser une image de médicament
    const handleAnalyzeMedicationImage = async (source: 'camera' | 'gallery') => {
        hapticPress();
        
        try {
            let result;
            
            if (source === 'camera') {
                const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
                if (cameraStatus !== 'granted') {
                    Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la caméra');
                    return;
                }
                
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.8,
                    base64: true,
                });
            } else {
                const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (galleryStatus !== 'granted') {
                    Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la galerie');
                    return;
                }
                
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.8,
                    base64: true,
                });
            }

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const base64Image = `data:image/jpeg;base64,${asset.base64}`;
                setSelectedMedicationImage(asset.uri);
                setAnalyzingImage(true);
                setImageAnalysisResult(null);

                // Analyser l'image avec l'IA
                const analysisResponse = await imageAnalysisService.analyzePharmacyImage(base64Image);

                if (analysisResponse.success && analysisResponse.data) {
                    // Gérer différents formats de réponse
                    const analysis = analysisResponse.data.analysis || analysisResponse.data;
                    setImageAnalysisResult(analysis);
                    
                    // Afficher le résultat dans le chat IA
                    const description = analysis.description || analysis.interpretation || 'Analyse complétée';
                    const recommendations = analysis.recommendations ? 
                        (Array.isArray(analysis.recommendations) ? analysis.recommendations.join('\n') : analysis.recommendations) : '';
                    
                    setAiResponse(
                        `Analyse du médicament:\n\n${description}\n\n` +
                        (recommendations ? `Recommandations:\n${recommendations}` : '')
                    );
                    setShowAIChat(true);
                } else {
                    const errorMsg = analysisResponse.error || analysisResponse.data?.error || 'Impossible d\'analyser l\'image du médicament. L\'IA d\'analyse d\'images n\'est peut-être pas encore opérationnelle.';
                    Alert.alert(
                        'Erreur',
                        errorMsg,
                        [{ text: 'OK' }]
                    );
                }
            }
        } catch (err: any) {
            console.error('[PharmacieHomeScreen] Erreur analyse image:', err);
            Alert.alert('Erreur', err.message || 'Erreur lors de l\'analyse de l\'image');
        } finally {
            setAnalyzingImage(false);
        }
    };

    const showImageSourcePicker = () => {
        Alert.alert(
            'Analyser un médicament',
            'Comment souhaitez-vous ajouter l\'image du médicament?',
            [
                {
                    text: 'Prendre une photo',
                    onPress: () => handleAnalyzeMedicationImage('camera'),
                },
                {
                    text: 'Choisir depuis la galerie',
                    onPress: () => handleAnalyzeMedicationImage('gallery'),
                },
                {
                    text: 'Annuler',
                    style: 'cancel',
                },
            ]
        );
    };

    // Fonctions IA
    const handleGetDosage = async (medication: PharmacyProduct) => {
        hapticPress();
        setSelectedMedication(medication);
        setLoadingAI(true);
        setShowDosageModal(true);
        
        try {
            const response = await pharmacyService.suggestDosage(medication.nom_produit);
            
            // Gérer différents formats de réponse
            if (response.success) {
                const dosage = response.data?.dosage || response.dosage || response.data;
                if (dosage && (dosage.dosage || dosage.frequency)) {
                    setDosageData({
                        dosage: dosage.dosage || 'Consultez votre médecin',
                        frequency: dosage.frequency || 'Selon prescription',
                        duration: dosage.duration || 'Selon prescription',
                        precautions: Array.isArray(dosage.precautions) ? dosage.precautions : [],
                        warnings: Array.isArray(dosage.warnings) ? dosage.warnings : [],
                    });
                } else {
                    Alert.alert(
                        'Information non disponible',
                        'La posologie IA n\'est pas encore disponible pour ce médicament. Consultez votre médecin ou pharmacien.',
                        [{ text: 'OK', onPress: () => setShowDosageModal(false) }]
                    );
                }
            } else {
                const errorMsg = response.message || response.error || 'Impossible d\'obtenir la posologie. L\'IA de posologie n\'est peut-être pas encore opérationnelle.';
                Alert.alert('Erreur', errorMsg, [{ text: 'OK', onPress: () => setShowDosageModal(false) }]);
            }
        } catch (err: any) {
            console.error('[PharmacieHomeScreen] Erreur posologie:', err);
            const errorMsg = err.message || err.error || 'Erreur lors de la récupération de la posologie. L\'IA de posologie n\'est peut-être pas encore opérationnelle.';
            Alert.alert('Erreur', errorMsg, [{ text: 'OK', onPress: () => setShowDosageModal(false) }]);
        } finally {
            setLoadingAI(false);
        }
    };

    const handleCheckInteractions = async (medication: PharmacyProduct) => {
        hapticPress();
        setSelectedMedication(medication);
        setLoadingAI(true);
        setShowInteractionsModal(true);
        
        try {
            const response = await pharmacyService.checkInteractions([medication.nom_produit]);
            
            // Gérer différents formats de réponse
            if (response.success) {
                const interaction = response.data?.interaction || response.interaction || response.data;
                if (interaction && (interaction.severity || interaction.description)) {
                    setInteractionsData({
                        severity: interaction.severity || 'none',
                        description: interaction.description || 'Aucune interaction connue',
                        recommendation: interaction.recommendation || 'Consultez votre pharmacien',
                        alternative_suggestions: Array.isArray(interaction.alternative_suggestions) ? 
                            interaction.alternative_suggestions : [],
                    });
                } else {
                    Alert.alert(
                        'Information non disponible',
                        'Les interactions médicamenteuses ne sont pas encore disponibles pour ce médicament. Consultez votre pharmacien.',
                        [{ text: 'OK', onPress: () => setShowInteractionsModal(false) }]
                    );
                }
            } else {
                const errorMsg = response.message || response.error || 'Impossible de vérifier les interactions. L\'IA de vérification d\'interactions n\'est peut-être pas encore opérationnelle.';
                Alert.alert('Erreur', errorMsg, [{ text: 'OK', onPress: () => setShowInteractionsModal(false) }]);
            }
        } catch (err: any) {
            console.error('[PharmacieHomeScreen] Erreur interactions:', err);
            const errorMsg = err.message || err.error || 'Erreur lors de la vérification des interactions. L\'IA de vérification d\'interactions n\'est peut-être pas encore opérationnelle.';
            Alert.alert('Erreur', errorMsg, [{ text: 'OK', onPress: () => setShowInteractionsModal(false) }]);
        } finally {
            setLoadingAI(false);
        }
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'Prix sur demande';
        return `${price.toLocaleString()} FCFA`;
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec recherche */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#6EE7B7', '#34D399']}
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
                            <Text style={styles.headerTitle}>Pharmacie</Text>
                            {totalResults > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {totalResults} médicament{totalResults > 1 ? 's' : ''} disponible{totalResults > 1 ? 's' : ''}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                setShowFilters(true);
                            }}
                            style={styles.filterButton}
                            activeOpacity={0.7}
                        >
                            <SafeIcon 
                                name="filter" 
                                size={22} 
                                color="#FFFFFF" 
                                type="lucide" 
                            />
                            {activeFiltersCount > 0 && (
                                <View style={styles.filterBadge}>
                                    <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Barre de recherche */}
                    <View style={styles.searchContainer}>
                        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
                            <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Rechercher un médicament..."
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                                returnKeyType="search"
                                multiline={true}
                                numberOfLines={2}
                                textAlignVertical="top"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery('');
                                        handleSearch();
                                    }}
                                    style={styles.clearButton}
                                >
                                    <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                </TouchableOpacity>
                            )}
                            {/* ✅ NOUVEAU: Bouton de recherche */}
                            <TouchableOpacity
                                style={[styles.searchButton, !searchQuery.trim() && styles.searchButtonDisabled]}
                                onPress={handleSearch}
                                disabled={!searchQuery.trim()}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>

                {/* Quick filters */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickFiltersContainer}
                    style={styles.quickFiltersScroll}
                >
                    {quickFilters.map((filter) => (
                        <TouchableOpacity
                            key={filter.id}
                            style={styles.quickFilterChip}
                            onPress={() => handleQuickFilter(filter)}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name={filter.icon} size={16} color="#6EE7B7" type="lucide" />
                            <Text style={styles.quickFilterText}>{filter.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

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

                {/* Section Assistant IA */}
                <View style={styles.aiSection}>
                    <TouchableOpacity
                        style={styles.aiToggleButton}
                        onPress={() => {
                            hapticPress();
                            const newValue = !showAIChat;
                            
                            // ✅ CORRIGÉ: Mettre à jour l'état d'abord si on ouvre, puis animer
                            if (newValue) {
                                setShowAIChat(true);
                                // Démarrer l'animation après un court délai pour que le composant soit monté
                                requestAnimationFrame(() => {
                                    Animated.timing(aiChatHeight, {
                                        toValue: 1,
                                        duration: 300,
                                        useNativeDriver: false, // height n'est pas supporté par le driver natif
                                    }).start();
                                });
                            } else {
                                // Animer d'abord, puis masquer après l'animation
                                Animated.timing(aiChatHeight, {
                                    toValue: 0,
                                    duration: 300,
                                    useNativeDriver: false,
                                }).start(() => {
                                    setShowAIChat(false);
                                });
                            }
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={styles.aiToggleContent}>
                            <View style={styles.aiIconContainer}>
                                <SafeIcon name="brain" size={20} color="#059669" type="lucide" />
                            </View>
                            <View style={styles.aiToggleTextContainer}>
                                <Text style={styles.aiToggleTitle}>Assistant IA Pharmacie</Text>
                                <Text style={styles.aiToggleSubtitle}>
                                    Posez vos questions sur les médicaments
                                </Text>
                            </View>
                            <SafeIcon 
                                name={showAIChat ? "chevron-up" : "chevron-down"} 
                                size={20} 
                                color="#6B7280" 
                                type="lucide" 
                            />
                        </View>
                    </TouchableOpacity>

                    {showAIChat && (
                        <Animated.View 
                            style={[
                                styles.aiChatWrapper,
                                {
                                    height: aiChatHeight.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, 500], // ✅ Animation de 0 à 500px
                                    }),
                                    opacity: aiChatHeight, // ✅ Fade in/out
                                    overflow: 'hidden', // ✅ Masquer le contenu pendant l'animation
                                }
                            ]}
                        >
                            <KeyboardAwareScreen 
                                style={styles.aiChatScrollView}
                                contentContainerStyle={styles.aiChatScrollContent}
                                extraScrollHeight={100}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={true}
                            >
                                {/* Bouton analyse d'image */}
                                <TouchableOpacity
                                    style={styles.aiImageButton}
                                    onPress={showImageSourcePicker}
                                    activeOpacity={0.7}
                                    disabled={analyzingImage}
                                >
                                    <SafeIcon name="camera" size={20} color="#059669" type="lucide" />
                                    <Text style={styles.aiImageButtonText}>
                                        {analyzingImage ? 'Analyse en cours...' : 'Analyser un médicament (photo)'}
                                    </Text>
                                    {analyzingImage && (
                                        <ActivityIndicator size="small" color="#059669" style={{ marginLeft: 8 }} />
                                    )}
                                </TouchableOpacity>

                                {/* Aperçu image sélectionnée */}
                                {selectedMedicationImage && (
                                    <View style={styles.imagePreviewContainer}>
                                        <Image 
                                            source={{ uri: selectedMedicationImage }} 
                                            style={styles.imagePreview}
                                            resizeMode="contain"
                                        />
                                        <TouchableOpacity
                                            style={styles.removeImageButton}
                                            onPress={() => {
                                                setSelectedMedicationImage(null);
                                                setImageAnalysisResult(null);
                                            }}
                                        >
                                            <SafeIcon name="x" size={16} color="#FFFFFF" type="lucide" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Suggestions rapides - Scroll horizontal fonctionnel */}
                                {aiSuggestions.length > 0 && (
                                    <View style={styles.aiSuggestionsContainer}>
                                        <Text style={styles.aiSuggestionsTitle}>Suggestions :</Text>
                                        <ScrollView 
                                            horizontal 
                                            showsHorizontalScrollIndicator={true}
                                            contentContainerStyle={styles.aiSuggestionsScroll}
                                            nestedScrollEnabled={true}
                                            style={styles.aiSuggestionsScrollView}
                                        >
                                            {aiSuggestions.map((suggestion, index) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={styles.aiSuggestionChip}
                                                    onPress={() => {
                                                        hapticPress();
                                                        setAiQuestion(suggestion);
                                                        handleAskAI();
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={styles.aiSuggestionText} numberOfLines={2}>
                                                        {suggestion}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {/* Champ de question IA */}
                                <View style={styles.aiInputContainer}>
                                    <TextInput
                                        style={styles.aiInput}
                                        placeholder="Ex: Quels sont les effets secondaires de ce médicament?"
                                        placeholderTextColor="#9CA3AF"
                                        value={aiQuestion}
                                        onChangeText={setAiQuestion}
                                        multiline
                                        maxLength={500}
                                        textAlignVertical="top"
                                    />
                                    <TouchableOpacity
                                        style={[styles.aiSendButton, (!aiQuestion.trim() || aiLoading) && styles.aiSendButtonDisabled]}
                                        onPress={handleAskAI}
                                        disabled={!aiQuestion.trim() || aiLoading}
                                        activeOpacity={0.7}
                                    >
                                        {aiLoading ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <SafeIcon name="send" size={18} color="#FFFFFF" type="lucide" />
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Réponse IA */}
                                {aiResponse && (
                                    <View style={styles.aiResponseContainer}>
                                        <View style={styles.aiResponseHeader}>
                                            <SafeIcon name="brain" size={16} color="#059669" type="lucide" />
                                            <Text style={styles.aiResponseTitle}>Réponse IA</Text>
                                        </View>
                                        <ScrollView 
                                            style={styles.aiResponseTextScroll}
                                            nestedScrollEnabled={true}
                                        >
                                            <Text style={styles.aiResponseText}>{aiResponse}</Text>
                                        </ScrollView>
                                        <TouchableOpacity
                                            style={styles.aiClearButton}
                                            onPress={() => {
                                                hapticPress();
                                                setAiResponse(null);
                                                setAiQuestion('');
                                            }}
                                        >
                                            <Text style={styles.aiClearButtonText}>Nouvelle question</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </KeyboardAwareScreen>
                        </Animated.View>
                    )}
                </View>
            </View>

            {/* Liste des médicaments */}
            {loading && medications.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Recherche de médicaments...</Text>
                </View>
            ) : error && medications.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="pill" size={64} color="#9CA3AF" />
                    <Text style={styles.errorText}>{error}</Text>
                    <Text style={styles.errorSubtext}>
                        Essayez de modifier vos critères de recherche
                    </Text>
                    {activeFiltersCount > 0 && (
                        <TouchableOpacity
                            style={styles.clearFiltersButton}
                            onPress={clearFilters}
                        >
                            <Text style={styles.clearFiltersText}>Réinitialiser les filtres</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <FlatList
                    data={medications}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <MedicationCard
                            medication={item}
                            onPress={() => handleMedicationPress(item)}
                            onGetDosage={() => handleGetDosage(item)}
                            onCheckInteractions={() => handleCheckInteractions(item)}
                            formatPrice={formatPrice}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={[modernColors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="pill" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>Aucun médicament trouvé</Text>
                            <Text style={styles.emptySubtext}>
                                Essayez de modifier vos critères de recherche
                            </Text>
                            {activeFiltersCount > 0 && (
                                <TouchableOpacity
                                    style={styles.clearFiltersButton}
                                    onPress={clearFilters}
                                >
                                    <Text style={styles.clearFiltersText}>Réinitialiser les filtres</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            {/* Modal de filtres avancés */}
            <FiltersModal
                visible={showFilters}
                onClose={() => setShowFilters(false)}
                filters={filters}
                onFiltersChange={setFilters}
                location={location}
                onSearch={handleSearch}
            />

            {/* Modal de tri */}
            <SortModal
                visible={showSortModal}
                onClose={() => setShowSortModal(false)}
                sortBy={sortBy}
                onSortChange={setSortBy}
                sortOptions={sortOptions}
            />

            {/* Modal Posologie IA */}
            <DosageModal
                visible={showDosageModal}
                onClose={() => {
                    setShowDosageModal(false);
                    setDosageData(null);
                }}
                medication={selectedMedication}
                dosage={dosageData}
                loading={loadingAI}
            />

            {/* Modal Interactions IA */}
            <InteractionsModal
                visible={showInteractionsModal}
                onClose={() => {
                    setShowInteractionsModal(false);
                    setInteractionsData(null);
                }}
                medication={selectedMedication}
                interactions={interactionsData}
                loading={loadingAI}
            />

            {/* Modal Détails Médicament */}
            <MedicationDetailsModal
                visible={showDetailsModal}
                onClose={() => {
                    setShowDetailsModal(false);
                    setSelectedMedication(null);
                }}
                medication={selectedMedication}
                onGetDosage={() => {
                    setShowDetailsModal(false);
                    handleGetDosage(selectedMedication!);
                }}
                onCheckInteractions={() => {
                    setShowDetailsModal(false);
                    handleCheckInteractions(selectedMedication!);
                }}
            />
        </SafeNativeView>
    );
};

// Composant Card pour un médicament - À compléter
interface MedicationCardProps {
    medication: PharmacyProduct;
    onPress: () => void;
    onGetDosage: () => void;
    onCheckInteractions: () => void;
    formatPrice: (price?: number) => string;
}

const MedicationCard: React.FC<MedicationCardProps> = ({ 
    medication, 
    onPress, 
    onGetDosage, 
    onCheckInteractions,
    formatPrice 
}) => {
    return (
        <TouchableOpacity style={styles.medicationCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.medicationHeader}>
                <View style={styles.medicationHeaderLeft}>
                    <View style={styles.medicationIconContainer}>
                        <SafeIcon name="pill" size={24} color="#059669" type="lucide" />
                    </View>
                    <View style={styles.medicationInfo}>
                        <Text style={styles.medicationName} numberOfLines={2}>
                            {medication.nom_produit}
                        </Text>
                        {medication.categorie && (
                            <Text style={styles.medicationCategory}>{medication.categorie}</Text>
                        )}
                    </View>
                </View>
                {medication.stock > 0 && (
                    <View style={styles.stockBadge}>
                        <Text style={styles.stockText}>
                            {medication.stock} {medication.unite}
                        </Text>
                    </View>
                )}
            </View>

            {medication.description && (
                <Text style={styles.medicationDescription} numberOfLines={2}>
                    {medication.description}
                </Text>
            )}

            <View style={styles.medicationFooter}>
                <View style={styles.medicationPriceContainer}>
                    <Text style={styles.medicationPrice}>{formatPrice(medication.prix)}</Text>
                    {medication.pharmacy_name && (
                        <Text style={styles.pharmacyName} numberOfLines={1}>
                            {medication.pharmacy_name}
                        </Text>
                    )}
                    {medication.distance_km && (
                        <Text style={styles.distanceText}>
                            {medication.distance_km.toFixed(1)} km
                        </Text>
                    )}
                </View>
                <View style={styles.medicationActions}>
                    <TouchableOpacity
                        style={styles.aiButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            onGetDosage();
                        }}
                    >
                        <SafeIcon name="brain" size={16} color="#059669" type="lucide" />
                        <Text style={styles.aiButtonText}>Posologie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.aiButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            onCheckInteractions();
                        }}
                    >
                        <SafeIcon name="alert-triangle" size={16} color="#F59E0B" type="lucide" />
                        <Text style={styles.aiButtonText}>Interactions</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// Modal de filtres avancés
interface FiltersModalProps {
    visible: boolean;
    onClose: () => void;
    filters: ProductSearchFilters;
    onFiltersChange: (filters: ProductSearchFilters) => void;
    location: any;
    onSearch: () => void;
}

const FiltersModal: React.FC<FiltersModalProps> = ({
    visible,
    onClose,
    filters,
    onFiltersChange,
    location,
    onSearch,
}) => {
    const [minPrice, setMinPrice] = useState(filters.min_price?.toString() || '');
    const [maxPrice, setMaxPrice] = useState(filters.max_price?.toString() || '');
    const [onlyAvailable, setOnlyAvailable] = useState(filters.only_available || true);

    useEffect(() => {
        if (visible) {
            setMinPrice(filters.min_price?.toString() || '');
            setMaxPrice(filters.max_price?.toString() || '');
            setOnlyAvailable(filters.only_available || true);
        }
    }, [visible, filters]);

    const applyFilters = () => {
        const newFilters: ProductSearchFilters = {
            ...filters,
            min_price: minPrice ? parseFloat(minPrice) : undefined,
            max_price: maxPrice ? parseFloat(maxPrice) : undefined,
            only_available: onlyAvailable,
            lat: location?.coords?.latitude,
            lng: location?.coords?.longitude,
        };
        onFiltersChange(newFilters);
        onSearch();
        onClose();
    };

    const clearAll = () => {
        onFiltersChange({
            query: '',
            only_available: true,
            limit: 20,
            lat: location?.coords?.latitude,
            lng: location?.coords?.longitude,
            radius_km: 20,
        });
        setMinPrice('');
        setMaxPrice('');
        setOnlyAvailable(true);
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
                        <Text style={styles.modalTitle}>Filtres</Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {/* Prix */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Prix (FCFA)</Text>
                            <View style={styles.rangeInputs}>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Min"
                                    value={minPrice}
                                    onChangeText={setMinPrice}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.rangeSeparator}>-</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Max"
                                    value={maxPrice}
                                    onChangeText={setMaxPrice}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Distance */}
                        {location?.coords && (
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Distance maximum (km)</Text>
                                <TextInput
                                    style={styles.singleInput}
                                    placeholder="Ex: 20"
                                    value={filters.radius_km?.toString() || '20'}
                                    onChangeText={(text) => {
                                        const value = text ? parseFloat(text) : 20;
                                        onFiltersChange({
                                            ...filters,
                                            radius_km: value,
                                        });
                                    }}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}

                        {/* Disponibilité */}
                        <View style={styles.filterSection}>
                            <View style={styles.switchRow}>
                                <View style={styles.switchLabel}>
                                    <SafeIcon name="check-circle" size={20} color="#059669" type="lucide" />
                                    <Text style={styles.switchLabelText}>Uniquement disponibles</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.switch, onlyAvailable && styles.switchActive]}
                                    onPress={() => setOnlyAvailable(!onlyAvailable)}
                                >
                                    <View style={[styles.switchThumb, onlyAvailable && styles.switchThumbActive]} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={clearAll}
                        >
                            <Text style={styles.clearButtonText}>Tout effacer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={applyFilters}
                        >
                            <Text style={styles.applyButtonText}>Appliquer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

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
                                color={sortBy === option.value ? '#059669' : '#6B7280'}
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
                                <SafeIcon name="check" size={20} color="#059669" type="lucide" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

// Modal Posologie IA
interface DosageModalProps {
    visible: boolean;
    onClose: () => void;
    medication: PharmacyProduct | null;
    dosage: DosageRecommendation | null;
    loading: boolean;
}

const DosageModal: React.FC<DosageModalProps> = ({
    visible,
    onClose,
    medication,
    dosage,
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
                        <View style={styles.modalHeaderLeft}>
                            <View style={styles.modalIconContainer}>
                                <SafeIcon name="brain" size={24} color="#059669" type="lucide" />
                            </View>
                            <View>
                                <Text style={styles.modalTitle}>Posologie IA</Text>
                                {medication && (
                                    <Text style={styles.modalSubtitle}>{medication.nom_produit}</Text>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {loading ? (
                            <View style={styles.aiLoadingContainer}>
                                <ActivityIndicator size="large" color="#059669" />
                                <Text style={styles.aiLoadingText}>
                                    Analyse en cours par l'IA...
                                </Text>
                            </View>
                        ) : dosage ? (
                            <>
                                <View style={styles.dosageCard}>
                                    <Text style={styles.dosageLabel}>Dosage</Text>
                                    <Text style={styles.dosageValue}>{dosage.dosage}</Text>
                                </View>
                                <View style={styles.dosageCard}>
                                    <Text style={styles.dosageLabel}>Fréquence</Text>
                                    <Text style={styles.dosageValue}>{dosage.frequency}</Text>
                                </View>
                                <View style={styles.dosageCard}>
                                    <Text style={styles.dosageLabel}>Durée</Text>
                                    <Text style={styles.dosageValue}>{dosage.duration}</Text>
                                </View>
                                {dosage.precautions.length > 0 && (
                                    <View style={styles.warningsCard}>
                                        <Text style={styles.warningsTitle}>Précautions</Text>
                                        {dosage.precautions.map((precaution, index) => (
                                            <View key={index} style={styles.warningItem}>
                                                <SafeIcon name="info" size={16} color="#3B82F6" type="lucide" />
                                                <Text style={styles.warningText}>{precaution}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                {dosage.warnings.length > 0 && (
                                    <View style={styles.warningsCard}>
                                        <Text style={styles.warningsTitle}>Avertissements</Text>
                                        {dosage.warnings.map((warning, index) => (
                                            <View key={index} style={styles.warningItem}>
                                                <SafeIcon name="alert-triangle" size={16} color="#EF4444" type="lucide" />
                                                <Text style={styles.warningText}>{warning}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                <View style={styles.aiDisclaimer}>
                                    <SafeIcon name="info" size={16} color="#6B7280" type="lucide" />
                                    <Text style={styles.aiDisclaimerText}>
                                        Ces informations sont fournies à titre indicatif. Consultez toujours votre médecin ou pharmacien avant de prendre un médicament.
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.aiErrorContainer}>
                                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                                <Text style={styles.aiErrorText}>
                                    Impossible de charger la posologie
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

// Modal Interactions IA
interface InteractionsModalProps {
    visible: boolean;
    onClose: () => void;
    medication: PharmacyProduct | null;
    interactions: MedicationInteraction | null;
    loading: boolean;
}

const InteractionsModal: React.FC<InteractionsModalProps> = ({
    visible,
    onClose,
    medication,
    interactions,
    loading,
}) => {
    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'contraindicated':
                return '#EF4444';
            case 'major':
                return '#F59E0B';
            case 'moderate':
                return '#FBBF24';
            case 'minor':
                return '#10B981';
            default:
                return '#6B7280';
        }
    };

    const getSeverityLabel = (severity: string) => {
        switch (severity) {
            case 'contraindicated':
                return 'Contre-indiqué';
            case 'major':
                return 'Majeure';
            case 'moderate':
                return 'Modérée';
            case 'minor':
                return 'Mineure';
            default:
                return 'Aucune';
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
                        <View style={styles.modalHeaderLeft}>
                            <View style={styles.modalIconContainer}>
                                <SafeIcon name="alert-triangle" size={24} color="#F59E0B" type="lucide" />
                            </View>
                            <View>
                                <Text style={styles.modalTitle}>Interactions Médicamenteuses</Text>
                                {medication && (
                                    <Text style={styles.modalSubtitle}>{medication.nom_produit}</Text>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {loading ? (
                            <View style={styles.aiLoadingContainer}>
                                <ActivityIndicator size="large" color="#F59E0B" />
                                <Text style={styles.aiLoadingText}>
                                    Vérification des interactions en cours...
                                </Text>
                            </View>
                        ) : interactions ? (
                            <>
                                <View style={[styles.severityBadge, { backgroundColor: `${getSeverityColor(interactions.severity)}15` }]}>
                                    <View style={[styles.severityDot, { backgroundColor: getSeverityColor(interactions.severity) }]} />
                                    <Text style={[styles.severityLabel, { color: getSeverityColor(interactions.severity) }]}>
                                        {getSeverityLabel(interactions.severity)}
                                    </Text>
                                </View>
                                <View style={styles.interactionCard}>
                                    <Text style={styles.interactionDescription}>
                                        {interactions.description}
                                    </Text>
                                </View>
                                <View style={styles.interactionCard}>
                                    <Text style={styles.interactionRecommendation}>
                                        {interactions.recommendation}
                                    </Text>
                                </View>
                                {interactions.alternative_suggestions.length > 0 && (
                                    <View style={styles.alternativesCard}>
                                        <Text style={styles.alternativesTitle}>Alternatives suggérées</Text>
                                        {interactions.alternative_suggestions.map((alt, index) => (
                                            <View key={index} style={styles.alternativeItem}>
                                                <SafeIcon name="pill" size={16} color="#10B981" type="lucide" />
                                                <Text style={styles.alternativeText}>{alt}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                <View style={styles.aiDisclaimer}>
                                    <SafeIcon name="info" size={16} color="#6B7280" type="lucide" />
                                    <Text style={styles.aiDisclaimerText}>
                                        Cette analyse est fournie à titre informatif. Consultez toujours un professionnel de santé.
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.aiErrorContainer}>
                                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                                <Text style={styles.aiErrorText}>
                                    Impossible de vérifier les interactions
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

// Modal Détails Médicament
interface MedicationDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    medication: PharmacyProduct | null;
    onGetDosage: () => void;
    onCheckInteractions: () => void;
}

const MedicationDetailsModal: React.FC<MedicationDetailsModalProps> = ({
    visible,
    onClose,
    medication,
    onGetDosage,
    onCheckInteractions,
}) => {
    if (!medication) return null;

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
                        <Text style={styles.modalTitle}>Détails du médicament</Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        <View style={styles.medicationDetailsHeader}>
                            <View style={styles.medicationDetailsIcon}>
                                <SafeIcon name="pill" size={32} color="#059669" type="lucide" />
                            </View>
                            <View style={styles.medicationDetailsInfo}>
                                <Text style={styles.medicationDetailsName}>{medication.nom_produit}</Text>
                                {medication.categorie && (
                                    <Text style={styles.medicationDetailsCategory}>{medication.categorie}</Text>
                                )}
                            </View>
                        </View>

                        {medication.description && (
                            <View style={styles.detailsSection}>
                                <Text style={styles.detailsSectionTitle}>Description</Text>
                                <Text style={styles.detailsSectionText}>{medication.description}</Text>
                            </View>
                        )}

                        <View style={styles.detailsSection}>
                            <Text style={styles.detailsSectionTitle}>Informations</Text>
                            <View style={styles.detailsRow}>
                                <Text style={styles.detailsLabel}>Prix:</Text>
                                <Text style={styles.detailsValue}>
                                    {medication.prix ? `${medication.prix.toLocaleString()} FCFA` : 'Sur demande'}
                                </Text>
                            </View>
                            <View style={styles.detailsRow}>
                                <Text style={styles.detailsLabel}>Stock:</Text>
                                <Text style={styles.detailsValue}>
                                    {medication.stock} {medication.unite}
                                </Text>
                            </View>
                            {medication.code_barre && (
                                <View style={styles.detailsRow}>
                                    <Text style={styles.detailsLabel}>Code-barres:</Text>
                                    <Text style={styles.detailsValue}>{medication.code_barre}</Text>
                                </View>
                            )}
                        </View>

                        {medication.pharmacy_name && (
                            <View style={styles.detailsSection}>
                                <Text style={styles.detailsSectionTitle}>Pharmacie</Text>
                                <Text style={styles.detailsSectionText}>{medication.pharmacy_name}</Text>
                                {medication.pharmacy_ville && (
                                    <Text style={styles.detailsSectionText}>
                                        {medication.pharmacy_quartier && `${medication.pharmacy_quartier}, `}
                                        {medication.pharmacy_ville}
                                    </Text>
                                )}
                                {medication.distance_km && (
                                    <Text style={styles.detailsSectionText}>
                                        {medication.distance_km.toFixed(1)} km
                                    </Text>
                                )}
                            </View>
                        )}

                        <View style={styles.aiActionsSection}>
                            <Text style={styles.aiActionsTitle}>Fonctionnalités IA</Text>
                            <TouchableOpacity
                                style={styles.aiActionButton}
                                onPress={onGetDosage}
                            >
                                <SafeIcon name="brain" size={20} color="#059669" type="lucide" />
                                <Text style={styles.aiActionButtonText}>Posologie intelligente</Text>
                                <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.aiActionButton}
                                onPress={onCheckInteractions}
                            >
                                <SafeIcon name="alert-triangle" size={20} color="#F59E0B" type="lucide" />
                                <Text style={styles.aiActionButtonText}>Vérifier interactions</Text>
                                <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                            </TouchableOpacity>
                        </View>
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
    filterButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    filterBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    searchContainer: {
        marginTop: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    searchBarFocused: {
        borderColor: '#6EE7B7',
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
    quickFiltersScroll: {
        maxHeight: 60,
    },
    quickFiltersContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    quickFilterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
        marginRight: 8,
    },
    quickFilterText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#059669',
    },
    actionsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
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
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    errorSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    clearFiltersButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    clearFiltersText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 24,
    },
    // Medication Card styles
    medicationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    medicationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    medicationHeaderLeft: {
        flexDirection: 'row',
        flex: 1,
        gap: 12,
    },
    medicationIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    medicationInfo: {
        flex: 1,
    },
    medicationName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    medicationCategory: {
        fontSize: 12,
        color: '#6B7280',
        textTransform: 'uppercase',
    },
    stockBadge: {
        backgroundColor: '#059669',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    stockText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    medicationDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 12,
        lineHeight: 20,
    },
    medicationFooter: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    medicationPriceContainer: {
        marginBottom: 12,
    },
    medicationPrice: {
        fontSize: 20,
        fontWeight: '700',
        color: '#059669',
        marginBottom: 4,
    },
    pharmacyName: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 2,
    },
    distanceText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    medicationActions: {
        flexDirection: 'row',
        gap: 8,
    },
    aiButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 6,
    },
    aiButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
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
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    modalIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
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
    filterSection: {
        marginBottom: 24,
    },
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    rangeInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rangeInput: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    rangeSeparator: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
    },
    singleInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    switchLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    switchLabelText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
    },
    switch: {
        width: 50,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#D1D5DB',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    switchActive: {
        backgroundColor: '#059669',
    },
    switchThumb: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#FFFFFF',
        alignSelf: 'flex-start',
    },
    switchThumbActive: {
        alignSelf: 'flex-end',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    clearButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    applyButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: '#059669',
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Sort modal
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
        backgroundColor: '#ECFDF5',
    },
    sortOptionText: {
        flex: 1,
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    sortOptionTextActive: {
        color: '#059669',
        fontWeight: '600',
    },
    // AI Modals styles
    aiLoadingContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiLoadingText: {
        marginTop: 16,
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    aiErrorContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiErrorText: {
        marginTop: 16,
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
    },
    dosageCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    dosageLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    dosageValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    warningsCard: {
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    warningsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#92400E',
        marginBottom: 12,
    },
    warningItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 14,
        color: '#92400E',
        lineHeight: 20,
    },
    aiDisclaimer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        gap: 12,
        marginTop: 12,
    },
    aiDisclaimerText: {
        flex: 1,
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 18,
    },
    severityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        gap: 8,
    },
    severityDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    severityLabel: {
        fontSize: 14,
        fontWeight: '700',
    },
    interactionCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    interactionDescription: {
        fontSize: 14,
        color: '#111827',
        lineHeight: 20,
        marginBottom: 8,
    },
    interactionRecommendation: {
        fontSize: 14,
        color: '#111827',
        lineHeight: 20,
        fontWeight: '600',
    },
    alternativesCard: {
        backgroundColor: '#D1FAE5',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    alternativesTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#065F46',
        marginBottom: 12,
    },
    alternativeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    alternativeText: {
        flex: 1,
        fontSize: 14,
        color: '#065F46',
    },
    // Medication Details Modal
    medicationDetailsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    medicationDetailsIcon: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    medicationDetailsInfo: {
        flex: 1,
    },
    medicationDetailsName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    medicationDetailsCategory: {
        fontSize: 14,
        color: '#6B7280',
        textTransform: 'uppercase',
    },
    detailsSection: {
        marginBottom: 24,
    },
    detailsSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    detailsSectionText: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    detailsLabel: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    detailsValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '600',
    },
    aiActionsSection: {
        marginTop: 8,
    },
    aiActionsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    aiActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        gap: 12,
    },
    aiActionButtonText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    // Styles pour Assistant IA
    aiSection: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    aiToggleButton: {
        padding: 16,
    },
    aiToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    aiIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiToggleTextContainer: {
        flex: 1,
    },
    aiToggleTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    aiToggleSubtitle: {
        fontSize: 12,
        color: '#6B7280',
    },
    aiChatWrapper: {
        maxHeight: 500, // ✅ Hauteur maximale pour limiter l'affichage
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        // ✅ Note: La hauteur réelle est gérée par l'animation Animated.View
    },
    aiChatScrollView: {
        height: '100%', // ✅ CORRIGÉ: Utiliser height: '100%' au lieu de flex: 1 pour garantir l'affichage
        backgroundColor: '#F9FAFB',
    },
    aiChatScrollContent: {
        padding: 16,
        paddingBottom: 20,
        gap: 12,
    },
    aiSuggestionsContainer: {
        marginBottom: 12,
    },
    aiSuggestionsTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    aiSuggestionsScrollView: {
        marginVertical: 8,
    },
    aiSuggestionsScroll: {
        paddingRight: 16,
        gap: 8,
    },
    aiSuggestionChip: {
        backgroundColor: '#ECFDF5',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#D1FAE5',
        minWidth: 120,
        maxWidth: 280,
    },
    aiSuggestionText: {
        fontSize: 13,
        color: '#059669',
        fontWeight: '500',
        textAlign: 'center',
    },
    aiInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: 12,
        marginTop: 8,
    },
    aiInput: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        minHeight: 44,
        maxHeight: 120,
    },
    aiSendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#059669',
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiSendButtonDisabled: {
        backgroundColor: '#D1D5DB',
        opacity: 0.5,
    },
    aiResponseContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginTop: 8,
        maxHeight: 300,
    },
    aiResponseTextScroll: {
        maxHeight: 200,
    },
    aiResponseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    aiResponseTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#059669',
    },
    aiResponseText: {
        fontSize: 14,
        color: '#111827',
        lineHeight: 20,
        marginBottom: 12,
    },
    aiClearButton: {
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    aiClearButtonText: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '600',
    },
    aiImageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#D1FAE5',
    },
    aiImageButtonText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#059669',
        marginLeft: 12,
    },
    imagePreviewContainer: {
        position: 'relative',
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    imagePreview: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    removeImageButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default PharmacieHomeScreen;

