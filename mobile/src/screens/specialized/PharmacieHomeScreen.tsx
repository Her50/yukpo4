// ✅ Écran Pharmacie MODERNE - Refonte complète avec UX de niveau mondial
// ÉTAPE 1: Structure de base et header

import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useToaster } from '../../components/ToasterProvider';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { useAIWithFallback } from '../../hooks/useAIWithFallback';
import {
    NearbyMedicineFilters,
    PharmacyProduct,
    pharmacyProductService,
    ProductSearchFilters
} from '../../services/pharmacyProductService';
import { DosageRecommendation, MedicationInteraction, pharmacyService } from '../../services/pharmacyService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'distance_asc' | 'name_asc';

const PharmacieHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();
    const toaster = useToaster();

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [medications, setMedications] = useState<PharmacyProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastNearbyRawResults, setLastNearbyRawResults] = useState<any[]>([]);

    // États UI
    const [sortBy, setSortBy] = useState<SortOption>('relevance');
    const [showFilters, setShowFilters] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [onDutyOnly, setOnDutyOnly] = useState(false);

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

    // États pour assistant IA conversationnel (avec fallback 3 niveaux)
    const { askPharmacyQuestion, checkDrugInteractions, getDosageRecommendation, loading: aiLoading } = useAIWithFallback();
    const [aiQuestion, setAiQuestion] = useState('');
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [showAIChat, setShowAIChat] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [aiChatHeight] = useState(new Animated.Value(0)); // ✅ NOUVEAU: Animation pour le déroulement

    // États pour analyse d'image
    const [selectedMedicationImage, setSelectedMedicationImage] = useState<string | null>(null);
    const [imageAnalysisResult, setImageAnalysisResult] = useState<any | null>(null);
    const [analyzingImage, setAnalyzingImage] = useState(false);

    // États pour scan ordonnance (extraction IA → recherche pharmacies)
    const [showOrdonnanceModal, setShowOrdonnanceModal] = useState(false);
    const [extractingOrdonnance, setExtractingOrdonnance] = useState(false);
    const [extractedMedications, setExtractedMedications] = useState<Array<{ name: string; dosage?: string; quantity?: number; posologie?: string }> | null>(null);

    // États pour recherche multi-médicaments par texte + filtres proximité
    const [textMedications, setTextMedications] = useState<string[]>([]);
    const [medInputValue, setMedInputValue] = useState('');
    const [maxDistance, setMaxDistance] = useState(20);
    const [searchOnDutyOnly, setSearchOnDutyOnly] = useState(false);
    const [searchAvailableOnly, setSearchAvailableOnly] = useState(true);
    const [showSearchGPSModal, setShowSearchGPSModal] = useState(false);
    const [searchGpsString, setSearchGpsString] = useState('');
    const [searchGpsData, setSearchGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showAdvancedSearchFilters, setShowAdvancedSearchFilters] = useState(false);

    const sortOptions: { value: SortOption; label: string; icon: string }[] = useMemo(
        () => [
            { value: 'relevance', label: t('pharmacieHome.sortRelevance'), icon: 'star' },
            { value: 'price_asc', label: t('pharmacieHomeScreen.prixCroissant'), icon: 'arrow-up' },
            { value: 'price_desc', label: t('pharmacieHome.prixDecroissant'), icon: 'arrow-down' },
            { value: 'distance_asc', label: t('pharmacieHome.sortDistance'), icon: 'map-pin' },
            { value: 'name_asc', label: t('pharmacieHomeScreen.nomAz'), icon: 'type' },
        ],
        [t]
    );

    // Obtenir l'icône du tri courant
    const getCurrentSortIcon = () => {
        const currentOption = sortOptions.find(o => o.value === sortBy);
        return currentOption?.icon || 'arrow-up-down';
    };

    const quickFilters = useMemo(
        () => [
            { id: 'proche', label: t('pharmacieHome.chipNearMe'), icon: 'map-pin', distance: 10 },
            { id: 'disponible', label: t('pharmacieHome.chipAvailable'), icon: 'check-circle', available: true },
            { id: 'garde', label: t('pharmacieHome.onDutyOnly') || 'De garde', icon: 'shield-check' },
            { id: 'prix_bas', label: t('pharmacieHomeScreen.prixBas'), icon: 'tag' },
        ],
        [t]
    );

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
        if (onDutyOnly) count++;
        setActiveFiltersCount(count);
    }, [filters, onDutyOnly]);

    // Charger les médicaments
    const loadMedications = useCallback(async (initialLoad: boolean = false) => {
        try {
            if (initialLoad) {
                setLoading(true);
                setError(null);
            }

            const nearbyFilters: NearbyMedicineFilters = {
                q: (searchQuery.trim() || filters.query || '').trim(),
                lat: filters.lat,
                lng: filters.lng,
                radius_km: filters.radius_km,
                quantity: 1,
                max_price: filters.max_price as number | undefined,
                on_duty_only: onDutyOnly,
                limit: filters.limit || 20,
            };

            const response = await pharmacyProductService.searchNearbyMedicines(nearbyFilters);

            const r = response.data as any;
            if (response.success && r?.items) {
                const items = Array.isArray(r.items) ? r.items : [];
                setLastNearbyRawResults(items);

                let results: PharmacyProduct[] = items.map((item: any) => ({
                    id: item.id,
                    pharmacy_service_id: item.pharmacy_service_id,
                    nom_produit: item.nom_produit,
                    description: item.description,
                    prix: item.prix,
                    stock: item.stock,
                    unite: item.unite,
                    code_barre: item.code_barre,
                    categorie: item.categorie,
                    distance_km: item.distance_km,
                    pharmacy_name: item.pharmacy_nom || item.pharmacy_name,
                    pharmacy_ville: item.pharmacy_ville,
                    pharmacy_quartier: item.pharmacy_quartier,
                    pharmacy_gps: item.pharmacy_gps,
                    pharmacy_telephone: item.pharmacy_telephone || item.telephone,
                    pharmacy_whatsapp: item.pharmacy_whatsapp,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                }));
                setHasMore(items.length >= (nearbyFilters.limit || 20));

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
                setPage(1);
            } else {
                setError(t('pharmacieHome.aucunMedicamentTrouve'));
                setMedications([]);
                setLastNearbyRawResults([]);
            }
        } catch (err: any) {
            console.error('[PharmacieHomeScreen] Erreur chargement:', err);
            setError(err.message || t('pharmacieHome.errorLoadingList'));
            setMedications([]);
            setLastNearbyRawResults([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters, searchQuery, sortBy]);

    const handleRefresh = () => {
        setRefreshing(true);
        setPage(1);
        loadMedications(false);
    };

    const handleLoadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const nextLimit = nextPage * 20;
            const searchFilters: NearbyMedicineFilters = {
                q: (searchQuery.trim() || filters.query || '').trim(),
                lat: filters.lat,
                lng: filters.lng,
                radius_km: filters.radius_km,
                quantity: 1,
                max_price: filters.max_price as number | undefined,
                on_duty_only: onDutyOnly,
                limit: nextLimit,
            };
            const response = await pharmacyProductService.searchNearbyMedicines(searchFilters);
            const r = response.data as any;
            if (response.success && r?.items) {
                const allItems = Array.isArray(r.items) ? r.items : [];
                const prevCount = lastNearbyRawResults.length;
                const appended = allItems.slice(prevCount);

                const mappedAppended: PharmacyProduct[] = appended.map((item: any) => ({
                    id: item.id,
                    pharmacy_service_id: item.pharmacy_service_id,
                    nom_produit: item.nom_produit,
                    description: item.description,
                    prix: item.prix,
                    stock: item.stock,
                    unite: item.unite,
                    code_barre: item.code_barre,
                    categorie: item.categorie,
                    distance_km: item.distance_km,
                    pharmacy_name: item.pharmacy_nom || item.pharmacy_name,
                    pharmacy_ville: item.pharmacy_ville,
                    pharmacy_quartier: item.pharmacy_quartier,
                    pharmacy_gps: item.pharmacy_gps,
                    pharmacy_telephone: item.pharmacy_telephone || item.telephone,
                    pharmacy_whatsapp: item.pharmacy_whatsapp,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                }));

                if (mappedAppended.length === 0) {
                    setHasMore(false);
                } else {
                    setMedications(prev => [...prev, ...mappedAppended]);
                    setLastNearbyRawResults(allItems);
                    setPage(nextPage);
                    setHasMore(allItems.length >= nextLimit);
                    setTotalResults(allItems.length);
                }
            }
        } catch (err) { console.warn('[PharmacieHome] Load more error:', err); }
        finally { setLoadingMore(false); }
    }, [page, loadingMore, hasMore, filters, searchQuery, lastNearbyRawResults, onDutyOnly]);

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
        if (filter.id === 'garde') {
            setOnDutyOnly((prev) => !prev);
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
        setOnDutyOnly(false);
        setSearchQuery('');
        loadMedications(false);
    };

    const handleSearch = () => {
        hapticPress();
        loadMedications(false);
    };

    // ✅ REFONDU: Fonction IA avec fallback 3 niveaux (ne plante plus jamais)
    const handleAskAI = async () => {
        if (!aiQuestion.trim()) {
            toaster.warning(t('pharmacieHome.pleaseEnterQuestion'));
            return;
        }

        hapticPress();
        setAiResponse(null);

        const medNames = medications.slice(0, 5).map(m => m.nom_produit);
        const result = await askPharmacyQuestion(aiQuestion, medNames);

        if (result.success && result.data) {
            const message = result.data.message || t('pharmacieHome.reponseNonDisponible');
            setAiResponse(message);
            if (result.data.suggestions?.length > 0) {
                setAiSuggestions(result.data.suggestions);
            }
            if (result.source === 'local') {
                toaster?.show?.(t('pharmacieHome.responseLocalData'), 'info');
            } else {
                toaster?.show?.(t('pharmacieHome.aiResponseGenerated'), 'success');
            }
        } else {
            setAiResponse(t('pharmacieHomeScreen.consultezVotrePharmacienPourDesConseils'));
            toaster?.show?.(t('pharmacieHome.aiTemporarilyUnavailable'), 'error');
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
                t('pharmacieHomeScreen.quelsMedicamentsPourLaFievre'),
                t('pharmacieHomeScreen.commentTraiterUnMalDeTete'),
                t('pharmacieHomeScreen.quelsSontLesMedicamentsDisponiblesPres')
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
                    Alert.alert(t('pharmacieHome.permissionRequired'), t('pharmacieHome.allowCamera'));
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
                    Alert.alert(t('pharmacieHome.permissionRequired'), t('pharmacieHome.allowGallery'));
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
                setSelectedMedicationImage(asset.uri);
                setAnalyzingImage(true);
                setImageAnalysisResult(null);

                // Étape 1 : extraction IA des médicaments via le vrai endpoint Vision AI
                const base64Pure = asset.base64!;
                const extraction = await pharmacyService.extractOrdonnance(base64Pure);

                if (extraction.success && extraction.medications && extraction.medications.length > 0) {
                    const firstMed = extraction.medications[0];
                    const medNames = extraction.medications.map(m => m.name).join(', ');
                    setImageAnalysisResult({ medications: extraction.medications });

                    // Étape 2 : poser une question IA automatique sur le médicament identifié
                    const question = `Médicament identifié sur l'image : ${medNames}. Donnez-moi des informations : posologie, indications, effets secondaires et précautions importantes.`;
                    setAiQuestion(question);

                    const aiResult = await askPharmacyQuestion(question, [firstMed.name]);
                    if (aiResult.success && aiResult.data) {
                        setAiResponse(
                            `📷 Médicament identifié : **${medNames}**\n\n` +
                            (firstMed.dosage ? `Dosage : ${firstMed.dosage}\n` : '') +
                            (firstMed.posologie ? `Posologie : ${firstMed.posologie}\n\n` : '\n') +
                            aiResult.data
                        );
                    } else {
                        setAiResponse(`📷 Médicament identifié : **${medNames}**` +
                            (firstMed.dosage ? `\nDosage : ${firstMed.dosage}` : '') +
                            (firstMed.posologie ? `\nPosologie : ${firstMed.posologie}` : '')
                        );
                    }
                    setShowAIChat(true);
                } else {
                    // Aucun médicament détecté — l'image ne semble pas être une ordonnance ou un médicament
                    Alert.alert(
                        'Médicament non identifié',
                        extraction.error || 'Yukpo n\'a pas pu identifier un médicament dans cette image. Prenez une photo plus nette ou plus proche du médicament / de l\'emballage.',
                        [{ text: 'OK' }]
                    );
                }
            }
        } catch (err: any) {
            console.error('[PharmacieHomeScreen] Erreur analyse image:', err);
            Alert.alert(t('message.error'), err.message || t('pharmacieHome.imageAnalysisError'));
        } finally {
            setAnalyzingImage(false);
        }
    };

    const showImageSourcePicker = () => {
        Alert.alert(
            t('pharmacieHome.analyzeMedication'),
            t('pharmacieHome.howToAddImage'),
            [
                {
                    text: t('common.takePhoto'),
                    onPress: () => handleAnalyzeMedicationImage('camera'),
                },
                {
                    text: t('common.chooseFromGallery'),
                    onPress: () => handleAnalyzeMedicationImage('gallery'),
                },
                {
                    text: t('common.cancel'),
                    style: 'cancel',
                },
            ]
        );
    };

    // Capture et extraction IA d'ordonnance → recherche pharmacies ayant les médicaments
    const handleCaptureOrdonnance = async (source: 'camera' | 'gallery') => {
        hapticPress();
        setShowOrdonnanceModal(false);
        let result: ImagePicker.ImagePickerResult;
        if (source === 'camera') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Autorisez l\'accès à la caméra pour scanner une ordonnance.');
                return;
            }
            result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 });
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie.');
                return;
            }
            result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 });
        }
        if (result.canceled || !result.assets?.[0]?.base64) return;
        const base64 = result.assets[0].base64!;
        setExtractingOrdonnance(true);
        try {
            const extraction = await pharmacyService.extractOrdonnance(base64);
            if (extraction.success && extraction.medications && extraction.medications.length > 0) {
                setExtractedMedications(extraction.medications);
            } else {
                Alert.alert('Aucun médicament détecté', extraction.error || 'L\'IA n\'a pas pu identifier de médicaments dans cette image. Essayez avec une image plus nette.');
            }
        } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Impossible d\'analyser l\'ordonnance.');
        } finally {
            setExtractingOrdonnance(false);
        }
    };

    const handleSearchByOrdonnance = () => {
        if (!extractedMedications || extractedMedications.length === 0) return;
        hapticPress();
        const medications = extractedMedications.map(m => ({ name: m.name, quantity: m.quantity }));
        navigation.navigate('PharmacieList' as never, {
            filters: {
                ordonnance_medications: medications,
                lat: searchGpsData?.lat ?? location?.coords?.latitude,
                lng: searchGpsData?.lng ?? location?.coords?.longitude,
                max_distance_km: maxDistance > 0 ? maxDistance : undefined,
            }
        } as never);
    };

    // Gestion de la liste de médicaments saisie manuellement
    const addTextMedication = () => {
        const raw = medInputValue.trim();
        if (!raw) return;
        // Support saisie multiple séparée par virgules ou points-virgules
        const parts = raw.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        const toAdd = parts.filter(p => !textMedications.includes(p));
        if (toAdd.length > 0) {
            setTextMedications(prev => [...prev, ...toAdd]);
        }
        setMedInputValue('');
        hapticPress();
    };

    const removeTextMedication = (name: string) => {
        hapticPress();
        setTextMedications(prev => prev.filter(m => m !== name));
    };

    // Routing prioritaire de recherche (même logique que PharmacieSearchScreen)
    const handleSearchByMedications = () => {
        hapticPress();

        // Priorité 1 : médicaments saisis en liste → classement par complétude
        const activeMedications = textMedications.length > 0
            ? textMedications
            : medInputValue.trim()
                ? medInputValue.trim().split(/[,;]+/).map(s => s.trim()).filter(Boolean)
                : [];

        const gpsLat = searchGpsData?.lat ?? location?.coords?.latitude;
        const gpsLng = searchGpsData?.lng ?? location?.coords?.longitude;

        if (activeMedications.length > 0) {
            navigation.navigate('PharmacieList' as never, {
                filters: {
                    ordonnance_medications: activeMedications.map(name => ({ name })),
                    lat: gpsLat,
                    lng: gpsLng,
                    max_distance_km: maxDistance > 0 ? maxDistance : undefined,
                }
            } as never);
            return;
        }

        // Priorité 2 : pharmacies de garde
        if (searchOnDutyOnly) {
            navigation.navigate('PharmacieList' as never, {
                filters: {
                    on_duty_only: true,
                    lat: gpsLat,
                    lng: gpsLng,
                    max_distance_km: maxDistance > 0 ? maxDistance : undefined,
                }
            } as never);
            return;
        }

        // Priorité 3 : recherche de proximité classique
        navigation.navigate('PharmacieList' as never, {
            filters: {
                lat: gpsLat,
                lng: gpsLng,
                max_distance_km: maxDistance > 0 ? maxDistance : undefined,
                available_only: searchAvailableOnly,
            }
        } as never);
    };

    // GPS sélection pour la recherche de médicaments
    const handleSearchGPSSelect = (coordinates: string) => {
        setSearchGpsString(coordinates);
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
            setSearchGpsData({ lat, lng });
        }
        setShowSearchGPSModal(false);
    };

    // Initialiser le GPS de recherche depuis la localisation courante
    useEffect(() => {
        if (location?.coords && !searchGpsData) {
            setSearchGpsData({ lat: location.coords.latitude, lng: location.coords.longitude });
            setSearchGpsString(`${location.coords.latitude.toFixed(4)},${location.coords.longitude.toFixed(4)}`);
        }
    }, [location]);

    // ✅ REFONDU: Fonctions IA avec fallback 3 niveaux (ne plante plus jamais)
    const handleGetDosage = async (medication: PharmacyProduct) => {
        hapticPress();
        setSelectedMedication(medication);
        setLoadingAI(true);
        setShowDosageModal(true);

        const result = await getDosageRecommendation(medication.nom_produit);

        if (result.success && result.data) {
            const dosage = result.data;
            setDosageData({
                dosage: dosage.dosage || t('pharmacieHome.consultezVotreMedecin'),
                frequency: dosage.frequency || t('pharmacieHome.selonPrescription'),
                duration: dosage.duration || t('pharmacieHome.selonPrescription'),
                precautions: Array.isArray(dosage.precautions) ? dosage.precautions : [],
                warnings: Array.isArray(dosage.warnings) ? dosage.warnings : [],
            });
            if (result.source === 'local') {
                toaster?.show?.(t('pharmacieHome.infoLocalData'), 'info');
            }
        } else {
            setShowDosageModal(false);
            Alert.alert(t('pharmacieHome.unavailable'), t('pharmacieHome.consultPharmacistDosage'));
        }
        setLoadingAI(false);
    };

    const handleCheckInteractions = async (medication: PharmacyProduct) => {
        hapticPress();
        setSelectedMedication(medication);
        setLoadingAI(true);
        setShowInteractionsModal(true);

        const result = await checkDrugInteractions([medication.nom_produit]);

        if (result.success && result.data) {
            const interaction = result.data;
            setInteractionsData({
                severity: interaction.severity || 'none',
                description: interaction.description || t('pharmacieHome.aucuneInteractionConnue'),
                recommendation: interaction.recommendation || t('pharmacieHome.recommendConsultPharmacistShort'),
                alternative_suggestions: Array.isArray(interaction.alternative_suggestions) ?
                    interaction.alternative_suggestions : [],
            });
            if (result.source === 'local') {
                toaster?.show?.(t('pharmacieHome.consultPharmacistFull'), 'info');
            }
        } else {
            setShowInteractionsModal(false);
            Alert.alert(t('pharmacieHome.unavailable'), t('pharmacieHome.consultPharmacistInteractions'));
        }
        setLoadingAI(false);
    };

    // ✅ NOUVEAU: Vérifier disponibilité d'un médicament dans une pharmacie
    const handleCheckAvailability = async (medication: PharmacyProduct) => {
        hapticPress();
        try {
            const response = await pharmacyService.checkAvailability(
                medication.pharmacy_service_id, medication.nom_produit, 1
            );
            if (response?.available) {
                Alert.alert(
                    t('pharmacieHome.available'),
                    t('pharmacieHome.inStockMsg', { name: medication.nom_produit, qty: response.medication?.stock_quantity || '?', price: response.medication?.price ? response.medication.price.toLocaleString() + ' FCFA' : t('pharmacieHome.onRequest') }),
                    [
                        { text: t('common.reserve'), onPress: () => handleReserveMedication(medication) },
                        { text: t('common.ok') },
                    ]
                );
            } else {
                Alert.alert(t('pharmacieHome.notAvailable'), t('pharmacieHome.notInStock', { name: medication.nom_produit }));
            }
        } catch (err: any) {
            console.warn('[PharmacieHome] Erreur vérification stock:', err);
            toaster?.show?.(t('pharmacieHome.cannotCheckStock'), 'error');
        }
    };

    // Réserver un médicament puis créer la commande → QR code retrait/livraison
    const handleReserveMedication = async (medication: PharmacyProduct) => {
        hapticPress();
        // Étape 1 : choisir le mode de réception
        Alert.alert(
            'Commander ce médicament',
            `${medication.nom_produit} — Comment souhaitez-vous le récupérer ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: '🏪 Retrait en pharmacie',
                    onPress: () => _doOrderAndNavigateQR(medication, 'pickup'),
                },
                {
                    text: '🚴 Livraison à domicile',
                    onPress: () => _doOrderAndNavigateQR(medication, 'delivery'),
                },
            ]
        );
    };

    const _doOrderAndNavigateQR = async (medication: PharmacyProduct, deliveryMethod: 'pickup' | 'delivery') => {
        try {
            // Étape 2 : réserver pour bloquer le stock (2h)
            const resv = await pharmacyService.reserveMedication(
                medication.pharmacy_service_id, medication.nom_produit, 1
            );
            if (!resv?.reservation_id) {
                Alert.alert('Erreur', resv?.message || 'Impossible de réserver ce médicament.');
                return;
            }

            // Étape 3 : créer la commande (paiement depuis wallet)
            const order = await pharmacyService.createOrder(
                medication.pharmacy_service_id,
                {
                    medications: [{ medication_name: medication.nom_produit, quantity: 1 }],
                    delivery_method: deliveryMethod,
                    reservation_id: resv.reservation_id,
                }
            );

            if (order?.order_id) {
                // Étape 4 : afficher le QR code de retrait
                (navigation as any).navigate('PharmacyOrderQR', { orderId: order.order_id });
            } else {
                const msg = order?.message || 'Erreur lors de la commande.';
                if (msg.toLowerCase().includes('solde') || msg.toLowerCase().includes('insuffisant')) {
                    Alert.alert(
                        'Solde insuffisant',
                        msg,
                        [
                            { text: 'Annuler', style: 'cancel' },
                            { text: 'Recharger mon wallet', onPress: () => (navigation as any).navigate('WalletFinancial') },
                        ]
                    );
                } else {
                    Alert.alert('Erreur', msg);
                }
            }
        } catch (err: any) {
            console.warn('[PharmacieHome] Erreur commande:', err);
            Alert.alert('Erreur', err.message || 'Impossible de créer la commande.');
        }
    };

    const formatPrice = (price?: number) => {
        if (!price) return t('pharmacieHome.priceOnRequest');
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
                            <Text style={styles.headerTitle}>{t('pharmacieHome.screenTitle')}</Text>
                            {totalResults > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {t('pharmacieHome.medicamentsCount', { count: totalResults })}
                                </Text>
                            )}
                        </View>
                        {/* Bouton Mes commandes / QR codes */}
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                (navigation as any).navigate('MyPharmacyOrders');
                            }}
                            style={[styles.filterButton, { marginRight: 6 }]}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="shopping-bag" size={20} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
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
                    {onDutyOnly && (
                        <View style={styles.onDutyBadge}>
                            <SafeIcon name="shield-check" size={14} color="#FFFFFF" type="lucide" />
                            <Text style={styles.onDutyBadgeText}>
                                {t('pharmacieHome.onDutyOnly') || 'De garde seulement'}
                            </Text>
                        </View>
                    )}

                    {/* Barre de recherche */}
                    <View style={styles.searchContainer}>
                        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
                            <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={t('pharmacieHome.rechercherUnMedicament')}
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                                returnKeyType="search"
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
                            {sortOptions.find(o => o.value === sortBy)?.label || t('pharmacieHome.trier')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Bouton Scanner ordonnance */}
                <TouchableOpacity
                    style={styles.ordonnanceScanButton}
                    onPress={() => { hapticPress(); setShowOrdonnanceModal(true); }}
                    activeOpacity={0.8}
                    disabled={extractingOrdonnance}
                >
                    <SafeIcon name="file-scan" size={20} color="#FFFFFF" type="lucide" />
                    <Text style={styles.ordonnanceScanButtonText}>
                        {extractingOrdonnance ? 'Analyse en cours...' : 'Scanner une ordonnance'}
                    </Text>
                    {extractingOrdonnance
                        ? <ActivityIndicator size="small" color="#FFFFFF" />
                        : <SafeIcon name="chevron-right" size={18} color="rgba(255,255,255,0.7)" type="lucide" />
                    }
                </TouchableOpacity>

                {/* Résultat extraction ordonnance */}
                {extractingOrdonnance && (
                    <View style={styles.ordonnanceLoadingCard}>
                        <ActivityIndicator size="large" color="#EC4899" />
                        <Text style={styles.ordonnanceLoadingText}>L'IA analyse votre ordonnance...</Text>
                    </View>
                )}
                {extractedMedications && extractedMedications.length > 0 && (
                    <View style={styles.extractedMedsCard}>
                        <View style={styles.extractedMedsHeader}>
                            <SafeIcon name="check-circle" size={20} color="#10B981" type="lucide" />
                            <Text style={styles.extractedMedsTitle}>
                                {extractedMedications.length} médicament{extractedMedications.length > 1 ? 's' : ''} détecté{extractedMedications.length > 1 ? 's' : ''}
                            </Text>
                            <TouchableOpacity onPress={() => setExtractedMedications(null)}>
                                <SafeIcon name="x" size={18} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>
                        {extractedMedications.map((med, idx) => (
                            <View key={idx} style={styles.extractedMedItem}>
                                <SafeIcon name="pill" size={14} color="#EC4899" type="lucide" />
                                <View style={styles.extractedMedInfo}>
                                    <Text style={styles.extractedMedName}>{med.name}</Text>
                                    {(med.dosage || med.posologie) && (
                                        <Text style={styles.extractedMedDetail}>
                                            {[med.dosage, med.posologie].filter(Boolean).join(' · ')}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={styles.searchByOrdonnanceButton}
                            onPress={handleSearchByOrdonnance}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="map-pin" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchByOrdonnanceButtonText}>
                                Trouver les pharmacies avec ces médicaments
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Section Recherche multi-médicaments par texte */}
                <View style={styles.medSearchCard}>
                    <Text style={styles.medSearchTitle}>Recherche par médicaments</Text>
                    <Text style={styles.medSearchSubtitle}>
                        Saisissez plusieurs médicaments — les pharmacies seront classées par taux de disponibilité
                    </Text>

                    {/* Saisie + bouton ajout */}
                    <View style={styles.medInputRow}>
                        <View style={styles.medInputWrapper}>
                            <NativeInput
                                value={medInputValue}
                                onChangeText={setMedInputValue}
                                placeholder="Ex: Paracetamol, Amoxicilline..."
                                autoCapitalize="none"
                                onSubmitEditing={addTextMedication}
                                returnKeyType="done"
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.medAddButton}
                            onPress={addTextMedication}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="plus" size={20} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.medInputHint}>Séparez par virgule ou appuyez + pour en ajouter plusieurs</Text>

                    {/* Tags médicaments ajoutés */}
                    {textMedications.length > 0 && (
                        <View style={styles.medTagsContainer}>
                            {textMedications.map((name, idx) => (
                                <View key={idx} style={styles.medTag}>
                                    <SafeIcon name="pill" size={12} color="#EC4899" type="lucide" />
                                    <Text style={styles.medTagText}>{name}</Text>
                                    <TouchableOpacity
                                        onPress={() => removeTextMedication(name)}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <SafeIcon name="x" size={14} color="#9CA3AF" type="lucide" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {textMedications.length > 0 && (
                        <View style={styles.medMatchingInfo}>
                            <SafeIcon name="info" size={14} color="#3B82F6" type="lucide" />
                            <Text style={styles.medMatchingInfoText}>
                                Les pharmacies seront classées : 100% si tous disponibles, sinon % de complétude
                            </Text>
                        </View>
                    )}

                    {/* GPS position */}
                    <TouchableOpacity
                        style={styles.gpsButton}
                        onPress={() => { hapticPress(); setShowSearchGPSModal(true); }}
                    >
                        <SafeIcon name="map-pin" size={18} color="#EC4899" type="lucide" />
                        <Text style={styles.gpsButtonText} numberOfLines={1}>
                            {searchGpsString || 'Utiliser ma position GPS (optionnel)'}
                        </Text>
                        <SafeIcon name="chevron-right" size={18} color="#9CA3AF" type="lucide" />
                    </TouchableOpacity>

                    {/* Distance maximale */}
                    <View style={styles.distanceRow}>
                        <SafeIcon name="maximize-2" size={15} color="#6B7280" type="lucide" />
                        <Text style={styles.distanceLabel}>Distance max :</Text>
                        <TouchableOpacity
                            style={styles.distanceBtn}
                            onPress={() => { hapticPress(); setMaxDistance(d => Math.max(5, d - 5)); }}
                        >
                            <SafeIcon name="minus" size={16} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                        <Text style={styles.distanceValue}>{maxDistance} km</Text>
                        <TouchableOpacity
                            style={styles.distanceBtn}
                            onPress={() => { hapticPress(); setMaxDistance(d => Math.min(200, d + 5)); }}
                        >
                            <SafeIcon name="plus" size={16} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    {/* Options rapides */}
                    <TouchableOpacity
                        style={styles.advancedFiltersToggle}
                        onPress={() => { hapticPress(); setShowAdvancedSearchFilters(v => !v); }}
                    >
                        <SafeIcon name={showAdvancedSearchFilters ? 'chevron-up' : 'chevron-down'} size={18} color="#EC4899" type="lucide" />
                        <Text style={styles.advancedFiltersToggleText}>
                            {showAdvancedSearchFilters ? 'Masquer' : 'Afficher'} les options
                        </Text>
                    </TouchableOpacity>

                    {showAdvancedSearchFilters && (
                        <View style={styles.advancedOptionsBlock}>
                            {/* De garde uniquement */}
                            <View style={styles.optionRow}>
                                <SafeIcon name="clock" size={18} color="#EC4899" type="lucide" />
                                <Text style={styles.optionRowLabel}>De garde uniquement (24/7)</Text>
                                <TouchableOpacity
                                    style={[styles.toggle, searchOnDutyOnly && styles.toggleActive]}
                                    onPress={() => { hapticPress(); setSearchOnDutyOnly(v => !v); }}
                                >
                                    <Text style={[styles.toggleText, searchOnDutyOnly && styles.toggleTextActive]}>
                                        {searchOnDutyOnly ? 'OUI' : 'NON'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            {/* Disponibles maintenant */}
                            <View style={styles.optionRow}>
                                <SafeIcon name="check-circle" size={18} color="#10B981" type="lucide" />
                                <Text style={styles.optionRowLabel}>Disponibles maintenant</Text>
                                <TouchableOpacity
                                    style={[styles.toggle, searchAvailableOnly && styles.toggleActive]}
                                    onPress={() => { hapticPress(); setSearchAvailableOnly(v => !v); }}
                                >
                                    <Text style={[styles.toggleText, searchAvailableOnly && styles.toggleTextActive]}>
                                        {searchAvailableOnly ? 'OUI' : 'NON'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Bouton lancer la recherche */}
                    <TouchableOpacity
                        style={styles.medSearchButton}
                        onPress={handleSearchByMedications}
                        activeOpacity={0.8}
                    >
                        <SafeIcon name="search" size={18} color="#FFFFFF" type="lucide" />
                        <Text style={styles.medSearchButtonText}>Lancer la recherche</Text>
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
                                <Text style={styles.aiToggleTitle}>Assistant Yukpo</Text>
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
                                    maxHeight: aiChatHeight.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, 480],
                                    }),
                                    opacity: aiChatHeight,
                                }
                            ]}
                        >
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
                                style={{ flex: 1 }}
                            >
                                <ScrollView
                                    style={styles.aiChatScrollView}
                                    contentContainerStyle={styles.aiChatScrollContent}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={true}
                                    keyboardDismissMode="interactive"
                                >
                                {/* Bouton analyse d'image */}
                                <TouchableOpacity
                                    style={[styles.aiImageButton, styles.aiImageButtonPriority]}
                                    onPress={showImageSourcePicker}
                                    activeOpacity={0.7}
                                    disabled={analyzingImage}
                                >
                                    <SafeIcon name="camera" size={20} color="#059669" type="lucide" />
                                    <Text style={styles.aiImageButtonText}>
                                        {analyzingImage ? t('pharmacieHome.analysisInProgress') : t('pharmacieHomeScreen.analyserUnMedicamentPhoto')}
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
                                        <Text style={styles.aiSuggestionsTitle}>{t('pharmacieHome.suggestionsTitle')}</Text>
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

                                {/* Réponse IA (avant le champ : le composer reste en bas du scroll pour le clavier) */}
                                {aiResponse && (
                                    <View style={styles.aiResponseContainer}>
                                        <View style={styles.aiResponseHeader}>
                                            <SafeIcon name="brain" size={16} color="#059669" type="lucide" />
                                            <Text style={styles.aiResponseTitle}>{t('pharmacieHome.reponseIa')}</Text>
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
                                            <Text style={styles.aiClearButtonText}>{t('pharmacieHome.nouvelleQuestion')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                </ScrollView>
                                <View style={styles.aiInputWrapper}>
                                    <View style={styles.aiInputContainer}>
                                        <TextInput
                                            style={styles.aiInput}
                                            placeholder={t('pharmacieHome.exQuelsSontLesEffets')}
                                            placeholderTextColor="#9CA3AF"
                                            value={aiQuestion}
                                            onChangeText={setAiQuestion}
                                            multiline
                                            maxLength={500}
                                            textAlignVertical="top"
                                            returnKeyType="send"
                                            onSubmitEditing={handleAskAI}
                                            blurOnSubmit={false}
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
                                </View>
                            </KeyboardAvoidingView>
                        </Animated.View>
                    )}
                </View>
            </View>

            {/* Liste des médicaments */}
            {loading && medications.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('pharmacieHome.rechercheDeMedicaments')}</Text>
                </View>
            ) : error && medications.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="pill" size={64} color="#9CA3AF" />
                    <Text style={styles.errorText}>{error}</Text>
                    <Text style={styles.errorSubtext}>
                        {t('pharmacieHome.tryDifferentCriteria')}
                    </Text>
                    {activeFiltersCount > 0 && (
                        <TouchableOpacity
                            style={styles.clearFiltersButton}
                            onPress={clearFilters}
                        >
                            <Text style={styles.clearFiltersText}>{t('pharmacieHome.reinitialiserLesFiltres')}</Text>
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
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={modernColors.primary} style={{ paddingVertical: 16 }} /> : null}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="pill" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>{t('pharmacieHome.aucunMedicamentTrouve')}</Text>
                            <Text style={styles.emptySubtext}>
                                {t('pharmacieHome.tryDifferentCriteria')}
                            </Text>
                            {activeFiltersCount > 0 && (
                                <TouchableOpacity
                                    style={styles.clearFiltersButton}
                                    onPress={clearFilters}
                                >
                                    <Text style={styles.clearFiltersText}>{t('pharmacieHome.reinitialiserLesFiltres')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            {/* GPS Modal pour la recherche multi-médicaments */}
            <ModernGPSModal
                visible={showSearchGPSModal}
                onClose={() => setShowSearchGPSModal(false)}
                onSelect={handleSearchGPSSelect}
            />

            {/* Modal de filtres avancés */}
            <FiltersModal
                visible={showFilters}
                onClose={() => setShowFilters(false)}
                filters={filters}
                onFiltersChange={setFilters}
                onDutyOnly={onDutyOnly}
                onDutyOnlyChange={setOnDutyOnly}
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

            {/* Modal scanner ordonnance */}
            <Modal
                visible={showOrdonnanceModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowOrdonnanceModal(false)}
            >
                <TouchableOpacity
                    style={styles.ordonnanceModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOrdonnanceModal(false)}
                >
                    <View style={styles.ordonnanceModalContainer}>
                        <View style={styles.ordonnanceModalHandle} />
                        <Text style={styles.ordonnanceModalTitle}>Scanner une ordonnance</Text>
                        <Text style={styles.ordonnanceModalSubtitle}>
                            L'IA va extraire les médicaments et la posologie de votre ordonnance
                        </Text>
                        <TouchableOpacity
                            style={styles.ordonnanceModalButton}
                            onPress={() => handleCaptureOrdonnance('camera')}
                        >
                            <View style={styles.ordonnanceModalButtonIcon}>
                                <SafeIcon name="camera" size={24} color="#EC4899" type="lucide" />
                            </View>
                            <View style={styles.ordonnanceModalButtonText}>
                                <Text style={styles.ordonnanceModalButtonTitle}>Prendre une photo</Text>
                                <Text style={styles.ordonnanceModalButtonDesc}>Photographiez votre ordonnance maintenant</Text>
                            </View>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.ordonnanceModalButton}
                            onPress={() => handleCaptureOrdonnance('gallery')}
                        >
                            <View style={styles.ordonnanceModalButtonIcon}>
                                <SafeIcon name="image" size={24} color="#3B82F6" type="lucide" />
                            </View>
                            <View style={styles.ordonnanceModalButtonText}>
                                <Text style={styles.ordonnanceModalButtonTitle}>Choisir depuis la galerie</Text>
                                <Text style={styles.ordonnanceModalButtonDesc}>Sélectionnez une photo existante</Text>
                            </View>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.ordonnanceModalCancelButton}
                            onPress={() => setShowOrdonnanceModal(false)}
                        >
                            <Text style={styles.ordonnanceModalCancelText}>Annuler</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    const { t } = useLanguageSafe();
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
                            {medication.distance_km.toFixed(1)} {t('pharmacieHome.kmUnit')}
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
                        <Text style={styles.aiButtonText}>{t('pharmacieHome.posologieLabel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.aiButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            onCheckInteractions();
                        }}
                    >
                        <SafeIcon name="alert-triangle" size={16} color="#F59E0B" type="lucide" />
                        <Text style={styles.aiButtonText}>{t('pharmacieHome.interactionsLabel')}</Text>
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
    onDutyOnly: boolean;
    onDutyOnlyChange: (value: boolean) => void;
    location: any;
    onSearch: () => void;
}

const FiltersModal: React.FC<FiltersModalProps> = ({
    visible,
    onClose,
    filters,
    onFiltersChange,
    onDutyOnly,
    onDutyOnlyChange,
    location,
    onSearch,
}) => {
    const { t } = useLanguageSafe();
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
                        <Text style={styles.modalTitle}>{t('pharmacieHome.filtersTitle')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {/* Prix */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>{t('pharmacieHome.priceFcfa')}</Text>
                            <View style={styles.rangeInputs}>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder={t('pharmacieHome.min')}
                                    value={minPrice}
                                    onChangeText={setMinPrice}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.rangeSeparator}>-</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder={t('pharmacieHome.max')}
                                    value={maxPrice}
                                    onChangeText={setMaxPrice}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Distance */}
                        {location?.coords && (
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>{t('pharmacieHome.maxDistanceKm')}</Text>
                                <TextInput
                                    style={styles.singleInput}
                                    placeholder={t('pharmacieHome.distancePlaceholder')}
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
                                    <Text style={styles.switchLabelText}>{t('pharmacieHome.onlyAvailableInStock')}</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.switch, onlyAvailable && styles.switchActive]}
                                    onPress={() => setOnlyAvailable(!onlyAvailable as any)}
                                >
                                    <View style={[styles.switchThumb, onlyAvailable && styles.switchThumbActive]} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.switchRow}>
                                <View style={styles.switchLabel}>
                                    <SafeIcon name="shield-check" size={20} color="#2563EB" type="lucide" />
                                    <Text style={styles.switchLabelText}>
                                        {t('pharmacieHome.onDutyOnly') || 'Pharmacies de garde uniquement'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.switch, onDutyOnly && styles.switchActive]}
                                    onPress={() => onDutyOnlyChange(!onDutyOnly)}
                                >
                                    <View style={[styles.switchThumb, onDutyOnly && styles.switchThumbActive]} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={clearAll}
                        >
                            <Text style={styles.clearButtonText}>{t('pharmacieHome.clearAllFilters')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={applyFilters}
                        >
                            <Text style={styles.applyButtonText}>{t('common.apply')}</Text>
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
    const { t } = useLanguageSafe();
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
                                <Text style={styles.modalTitle}>{t('pharmacieHome.dosageIaTitle')}</Text>
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
                                    {t('pharmacieHome.analysisInProgressLong')}
                                </Text>
                            </View>
                        ) : dosage ? (
                            <>
                                <View style={styles.dosageCard}>
                                    <Text style={styles.dosageLabel}>{t('pharmacieHome.dosageLabel')}</Text>
                                    <Text style={styles.dosageValue}>{dosage.dosage}</Text>
                                </View>
                                <View style={styles.dosageCard}>
                                    <Text style={styles.dosageLabel}>{t('pharmacieHome.frequence')}</Text>
                                    <Text style={styles.dosageValue}>{dosage.frequency}</Text>
                                </View>
                                <View style={styles.dosageCard}>
                                    <Text style={styles.dosageLabel}>{t('pharmacieHome.duree')}</Text>
                                    <Text style={styles.dosageValue}>{dosage.duration}</Text>
                                </View>
                                {dosage.precautions.length > 0 && (
                                    <View style={styles.warningsCard}>
                                        <Text style={styles.warningsTitle}>{t('pharmacieHome.precautions')}</Text>
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
                                        <Text style={styles.warningsTitle}>{t('pharmacieHome.warningsTitle')}</Text>
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
                                        {t('pharmacieHome.disclaimerDosage')}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.aiErrorContainer}>
                                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                                <Text style={styles.aiErrorText}>
                                    {t('pharmacieHome.cannotLoadDosage')}
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
    const { t } = useLanguageSafe();
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
                return t('pharmacieHomeScreen.contreindique');
            case 'major':
                return t('pharmacieHome.severityMajor');
            case 'moderate':
                return t('pharmacieHomeScreen.moderee');
            case 'minor':
                return t('pharmacieHome.severityMinor');
            default:
                return t('pharmacieHome.severityNone');
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
                                <Text style={styles.modalTitle}>{t('pharmacieHome.interactionsMedicamenteuses')}</Text>
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
                                    {t('pharmacieHome.interactionsCheckingInProgress')}
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
                                        <Text style={styles.alternativesTitle}>{t('pharmacieHome.alternativesSuggerees')}</Text>
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
                                        {t('pharmacieHome.disclaimerInteractions')}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.aiErrorContainer}>
                                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                                <Text style={styles.aiErrorText}>
                                    {t('pharmacieHome.cannotVerifyInteractions')}
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
    const { t } = useLanguageSafe();
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
                        <Text style={styles.modalTitle}>{t('pharmacieHome.detailsDuMedicament')}</Text>
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
                                <Text style={styles.detailsSectionTitle}>{t('pharmacieHome.sectionDescription')}</Text>
                                <Text style={styles.detailsSectionText}>{medication.description}</Text>
                            </View>
                        )}

                        <View style={styles.detailsSection}>
                            <Text style={styles.detailsSectionTitle}>{t('pharmacieHome.sectionInfo')}</Text>
                            <View style={styles.detailsRow}>
                                <Text style={styles.detailsLabel}>{t('pharmacieHome.labelPrice')}</Text>
                                <Text style={styles.detailsValue}>
                                    {medication.prix
                                        ? `${medication.prix.toLocaleString()} ${t('pharmacieHome.currencyFcfa')}`
                                        : t('pharmacieHome.onRequest')}
                                </Text>
                            </View>
                            <View style={styles.detailsRow}>
                                <Text style={styles.detailsLabel}>{t('pharmacieHome.labelStock')}</Text>
                                <Text style={styles.detailsValue}>
                                    {medication.stock} {medication.unite}
                                </Text>
                            </View>
                            {medication.code_barre && (
                                <View style={styles.detailsRow}>
                                    <Text style={styles.detailsLabel}>{t('pharmacieHome.labelBarcode')}</Text>
                                    <Text style={styles.detailsValue}>{medication.code_barre}</Text>
                                </View>
                            )}
                        </View>

                        {medication.pharmacy_name && (
                            <View style={styles.detailsSection}>
                                <Text style={styles.detailsSectionTitle}>{t('pharmacieHome.sectionPharmacy')}</Text>
                                <Text style={styles.detailsSectionText}>{medication.pharmacy_name}</Text>
                                {medication.pharmacy_ville && (
                                    <Text style={styles.detailsSectionText}>
                                        {medication.pharmacy_quartier && `${medication.pharmacy_quartier}, `}
                                        {medication.pharmacy_ville}
                                    </Text>
                                )}
                                {medication.distance_km && (
                                    <Text style={styles.detailsSectionText}>
                                        {medication.distance_km.toFixed(1)} {t('pharmacieHome.kmUnit')}
                                    </Text>
                                )}
                            </View>
                        )}

                        <View style={styles.aiActionsSection}>
                            <Text style={styles.aiActionsTitle}>{t('pharmacieHome.fonctionnalitesIa')}</Text>
                            <TouchableOpacity
                                style={styles.aiActionButton}
                                onPress={onGetDosage}
                            >
                                <SafeIcon name="brain" size={20} color="#059669" type="lucide" />
                                <Text style={styles.aiActionButtonText}>{t('pharmacieHome.posologieIntelligente')}</Text>
                                <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.aiActionButton}
                                onPress={onCheckInteractions}
                            >
                                <SafeIcon name="alert-triangle" size={20} color="#F59E0B" type="lucide" />
                                <Text style={styles.aiActionButtonText}>{t('pharmacieHome.verifierInteractions')}</Text>
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
    onDutyBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(37, 99, 235, 0.9)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
        marginBottom: 10,
    },
    onDutyBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
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
    clearFilterButton: {
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
        zIndex: 120,
        elevation: 8,
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
        flex: 1,
        backgroundColor: '#F9FAFB',
        maxHeight: 350,
    },
    aiChatScrollContent: {
        padding: 16,
        paddingBottom: 16,
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
    aiInputWrapper: {
        position: 'relative',
        paddingBottom: 8,
        paddingTop: 8,
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    aiInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: 0,
        marginTop: 0,
        paddingHorizontal: 4,
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
    aiImageButtonPriority: {
        zIndex: 200,
        elevation: 20,
        position: 'relative',
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
    // Section recherche multi-médicaments
    medSearchCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    medSearchTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    medSearchSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 17,
        marginBottom: 14,
    },
    medInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    medInputWrapper: {
        flex: 1,
    },
    medAddButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#EC4899',
        justifyContent: 'center',
        alignItems: 'center',
    },
    medInputHint: {
        fontSize: 11,
        color: '#9CA3AF',
        marginBottom: 10,
        fontStyle: 'italic',
    },
    medTagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    medTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
        borderWidth: 1,
        borderColor: '#FBCFE8',
    },
    medTagText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9D174D',
    },
    medMatchingInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginBottom: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    medMatchingInfoText: {
        flex: 1,
        fontSize: 12,
        color: '#1E40AF',
        lineHeight: 16,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 8,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 13,
        color: '#374151',
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    distanceLabel: {
        flex: 1,
        fontSize: 13,
        color: '#374151',
    },
    distanceBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#EC4899',
        justifyContent: 'center',
        alignItems: 'center',
    },
    distanceValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        minWidth: 52,
        textAlign: 'center',
    },
    advancedFiltersToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        marginBottom: 4,
    },
    advancedFiltersToggleText: {
        fontSize: 13,
        color: '#EC4899',
        fontWeight: '600',
    },
    advancedOptionsBlock: {
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        gap: 10,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    optionRowLabel: {
        flex: 1,
        fontSize: 13,
        color: '#374151',
    },
    toggle: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: '#E5E7EB',
    },
    toggleActive: {
        backgroundColor: '#EC4899',
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
    },
    toggleTextActive: {
        color: '#FFFFFF',
    },
    medSearchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EC4899',
        borderRadius: 12,
        paddingVertical: 14,
        marginTop: 4,
        gap: 8,
    },
    medSearchButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    // Ordonnance scan
    ordonnanceScanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EC4899',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        gap: 10,
    },
    ordonnanceScanButtonText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    ordonnanceLoadingCard: {
        backgroundColor: '#FDF2F8',
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 16,
        marginBottom: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FBCFE8',
        gap: 12,
    },
    ordonnanceLoadingText: {
        fontSize: 14,
        color: '#EC4899',
        fontWeight: '500',
    },
    extractedMedsCard: {
        backgroundColor: '#F0FDF4',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    extractedMedsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    extractedMedsTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: '#065F46',
    },
    extractedMedItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#D1FAE5',
        gap: 10,
    },
    extractedMedInfo: {
        flex: 1,
    },
    extractedMedName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    extractedMedDetail: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    searchByOrdonnanceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EC4899',
        borderRadius: 12,
        paddingVertical: 14,
        marginTop: 16,
        gap: 8,
    },
    searchByOrdonnanceButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    // Modal ordonnance
    ordonnanceModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    ordonnanceModalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    ordonnanceModalHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#D1D5DB',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    ordonnanceModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 6,
    },
    ordonnanceModalSubtitle: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
        marginBottom: 24,
    },
    ordonnanceModalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    ordonnanceModalButtonIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    ordonnanceModalButtonText: {
        flex: 1,
    },
    ordonnanceModalButtonTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    ordonnanceModalButtonDesc: {
        fontSize: 12,
        color: '#6B7280',
    },
    ordonnanceModalCancelButton: {
        alignItems: 'center',
        paddingVertical: 14,
        marginTop: 4,
    },
    ordonnanceModalCancelText: {
        fontSize: 15,
        color: '#6B7280',
        fontWeight: '500',
    },
});

export default PharmacieHomeScreen;

