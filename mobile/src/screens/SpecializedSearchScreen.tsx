// 🔍 Page de recherche intermédiaire pour services spécialisés
// Permet de saisir les critères de recherche (texte, GPS, moment/planning) 
// avant de lancer la recherche dans les tables spécialisées

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';
import ModernGPSModal from '../components/ModernGPSModal';
import SafeIcon from '../components/SafeIcon';
import { NativeButton } from '../components/SafeNativeDesign';
import SavedSearches from '../components/SavedSearches';
import SearchFilters, { SearchFilters as SearchFiltersType } from '../components/SearchFilters';
import SearchHistory from '../components/SearchHistory';
import SpecializedSearchAutocomplete from '../components/SpecializedSearchAutocomplete';
import VoiceSearchButton from '../components/VoiceSearchButton';
import { useLocation } from '../contexts/LocationContext';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface SpecializedSearchScreenParams {
    specializedType: string;
    serviceName: string;
    serviceIcon?: string;
}

// ✅ NOUVEAU: Fonction pour générer des exemples de recherche adaptés au service spécialisé
const getPlaceholderExample = (specializedType: string): string => {
    const examples: Record<string, string> = {
        'pharmacie': t('specializedSearchScreen.exParacetamol500mgPharmacieDeGarde'),
        'hopital_clinique': t('specializedSearchScreen.exUrologueDisponibleConsultationPediatrieUrgence'),
        'laboratoire_imagerie': t('specializedSearchScreen.exPriseDeSangRadiographieAnalyse'),
        'agence_voyage': t('specializedSearchScreen.exBilletAvionDoualaparisReservationHotel'),
        'covoiturage': t('specializedSearchScreen.exTrajetDoualayaoundeCovoiturageQuotidienPartage'),
        'taxi_ville': t('specializedSearchScreen.exTaxiAeroportCourseCentrevilleTransport'),
        'banque_sang': 'Ex: don de sang, groupe sanguin O+, collecte mobile...',
    };

    return examples[specializedType] || 'Ex: rechercher un service...';
};

const SpecializedSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { location: userLocation } = useLocation();

    const params = route.params as SpecializedSearchScreenParams;
    const { specializedType, serviceName, serviceIcon } = params || {};

    const [searchQuery, setSearchQuery] = useState('');
    const [gpsString, setGpsString] = useState<string>('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number; address?: string } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [searchRadius, setSearchRadius] = useState(50); // km
    const [searchMoment, setSearchMoment] = useState<'now' | 'later' | 'specific'>('now');
    const [loading, setLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFiltersType>({} as any);

    // Initialiser le GPS avec la position actuelle si disponible
    useEffect(() => {
        if (userLocation?.coords) {
            const lat = userLocation.coords.latitude;
            const lng = userLocation.coords.longitude;
            setGpsString(`${lat},${lng}`);
            setGpsData({ lat, lng });
        }
    }, [userLocation]);

    const handleGPSSelect = (coordinates: string) => {
        setGpsString(coordinates);
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
            setGpsData({ lat, lng });
        }
        setShowGPSModal(false);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Recherche vide', 'Veuillez saisir un terme de recherche');
            return;
        }

        setLoading(true);
        try {
            // Construire le payload de recherche spécialisée
            const payload: any = {
                texte: searchQuery.trim(),
                specialized_type: specializedType, // ✅ Force la recherche dans la table spécialisée
            };

            // Ajouter GPS si disponible
            if (gpsData) {
                payload.gps_mobile = `${gpsData.lat},${gpsData.lng}`;
            }

            // Ajouter rayon de recherche
            if (searchRadius) {
                payload.search_radius_km = searchRadius;
            }

            // Ajouter moment/planning si spécifié (pour recherche avec planning)
            if (searchMoment === 'now') {
                // Utiliser le moment actuel (défaut du backend)
            } else if (searchMoment === 'later') {
                // TODO: Permettre de sélectionner une date/heure future
                // Pour l'instant, on utilise le moment actuel
            }

            // ✅ NOUVEAU Phase 4.2: Ajouter les filtres avancés
            if (filters.availability) {
                payload.availability = filters.availability;
            }
            if (filters.minPrice !== undefined) {
                payload.min_price = filters.minPrice;
            }
            if (filters.maxPrice !== undefined) {
                payload.max_price = filters.maxPrice;
            }
            if (filters.services && filters.services.length > 0) {
                payload.services = filters.services;
            }
            if (filters.rating !== undefined) {
                payload.min_rating = filters.rating;
            }

            console.log('[SpecializedSearchScreen] 🔍 Recherche spécialisée:', {
                specializedType,
                searchQuery,
                hasGPS: !!gpsData,
                radius: searchRadius,
                moment: searchMoment,
            });

            // Lancer la recherche via /api/search/direct qui détecte automatiquement specialized_type
            const response = await apiPost('/api/search/direct', payload);

            if (response?.success === false) {
                Alert.alert('Erreur', response.error || 'Erreur lors de la recherche');
                return;
            }

            // Extraire les résultats
            const responseData = response as any;
            const results = responseData?.resultats?.resultats || responseData?.resultats || responseData?.data || [];

            // ✅ NOUVEAU Phase 4.4: Sauvegarder dans l'historique
            try {
                await apiPost('/api/specialized-services/search-history', {
                    query: searchQuery.trim(),
                    specialized_type: specializedType,
                    filters: filters,
                    results_count: results.length,
                });
            } catch (error) {
                console.error('Erreur sauvegarde historique:', error);
            }

            // Naviguer vers ResultatBesoin avec les résultats
            (navigation as any).navigate('ResultatBesoin', {
                results: results,
                searchQuery: searchQuery.trim(),
                specializedType: specializedType,
                fromSpecializedSearch: true,
            });
        } catch (error: any) {
            console.error('[SpecializedSearchScreen] ❌ Erreur recherche:', error);
            Alert.alert('Erreur', error.message || t('specializedSearchScreen.erreurLorsDeLaRechercheSpecialisee'));
        } finally {
            setLoading(false);
        }
    };

    if (!specializedType || !serviceName) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>{t('specializedSearch.parametresManquants')}</Text>
                <NativeButton
                    title={t('specializedSearchScreen.retour')}
                    onPress={() => navigation.goBack()}
                    variant="primary"
                />
            </View>
        );
    }

    return (
        <KeyboardAwareScreen style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    {serviceIcon && (
                        <Text style={styles.serviceIcon}>{serviceIcon}</Text>
                    )}
                    <Text style={styles.serviceTitle}>{serviceName}</Text>
                    <Text style={styles.serviceSubtitle}>{t('specializedSearch.rechercheSpecialisee')}</Text>
                </View>
            </View>

            {/* ✅ NOUVEAU Phase 4.4 & 4.5: Historique et recherches sauvegardées */}
            {!searchQuery && (
                <>
                    <SavedSearches
                        onSelect={(query, type) => {
                            setSearchQuery(query);
                            if (type) {
                                // Optionnel: mettre à jour le type si différent
                            }
                        }}
                        specializedType={specializedType}
                    />
                    <SearchHistory
                        onSelect={(query, type) => {
                            setSearchQuery(query);
                        }}
                        specializedType={specializedType}
                    />
                </>
            )}

            {/* Formulaire de recherche */}
            <View style={styles.formContainer}>
                {/* ✅ NOUVEAU Phase 4.2: Bouton filtres */}
                <View style={styles.filtersHeader}>
                    <Text style={styles.filtersTitle}>{t('specializedSearch.filtresDeRecherche')}</Text>
                    <TouchableOpacity
                        style={styles.filtersButton}
                        onPress={() => setShowFilters(true)}
                    >
                        <SafeIcon name="filter" size={20} color={modernColors.primary} />
                        <Text style={styles.filtersButtonText}>
                            {Object.keys(filters).length > 0
                                ? `${Object.keys(filters).length} filtre(s)`
                                : 'Filtres'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ✅ NOUVEAU Phase 4.1: Champ de recherche avec autocomplete */}
                <View style={styles.inputGroup}>
                    <View style={styles.searchHeader}>
                        <Text style={styles.label}>Que recherchez-vous ?</Text>
                        {/* ✅ NOUVEAU Phase 4.3: Bouton recherche vocale */}
                        <VoiceSearchButton
                            onTranscript={(text) => {
                                setSearchQuery(text);
                                // Optionnel: lancer la recherche automatiquement
                                // handleSearch();
                            }}
                        />
                    </View>
                    <SpecializedSearchAutocomplete
                        specializedType={specializedType}
                        onSelect={(query) => {
                            setSearchQuery(query);
                            // Optionnel: lancer la recherche automatiquement
                        }}
                        placeholder={getPlaceholderExample(specializedType)}
                        prefillQuery={searchQuery}
                    />
                </View>

                {/* GPS */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('specializedSearch.localisationOptionnel')}</Text>
                    <TouchableOpacity
                        style={styles.gpsButton}
                        onPress={() => setShowGPSModal(true)}
                    >
                        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                        <Text style={styles.gpsButtonText}>
                            {gpsData
                                ? `${gpsData.lat.toFixed(4)}, ${gpsData.lng.toFixed(4)}`
                                : t('specializedSearchScreen.selectionnerUnePositionGps')}
                        </Text>
                        <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Rayon de recherche */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Rayon de recherche : {searchRadius} km</Text>
                    <View style={styles.radiusSelector}>
                        {[10, 25, 50, 100].map((radius) => (
                            <TouchableOpacity
                                key={radius}
                                style={[
                                    styles.radiusButton,
                                    searchRadius === radius && styles.radiusButtonActive,
                                ]}
                                onPress={() => setSearchRadius(radius)}
                            >
                                <Text
                                    style={[
                                        styles.radiusButtonText,
                                        searchRadius === radius && styles.radiusButtonTextActive,
                                    ]}
                                >
                                    {radius} km
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Moment/Planning */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Quand ?</Text>
                    <View style={styles.momentSelector}>
                        <TouchableOpacity
                            style={[
                                styles.momentButton,
                                searchMoment === 'now' && styles.momentButtonActive,
                            ]}
                            onPress={() => setSearchMoment('now')}
                        >
                            <SafeIcon
                                name="clock"
                                size={20}
                                color={searchMoment === 'now' ? '#fff' : modernColors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.momentButtonText,
                                    searchMoment === 'now' && styles.momentButtonTextActive,
                                ]}
                            >
                                Maintenant
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.momentButton,
                                searchMoment === 'later' && styles.momentButtonActive,
                            ]}
                            onPress={() => setSearchMoment('later')}
                        >
                            <SafeIcon
                                name="calendar"
                                size={20}
                                color={searchMoment === 'later' ? '#fff' : modernColors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.momentButtonText,
                                    searchMoment === 'later' && styles.momentButtonTextActive,
                                ]}
                            >
                                Plus tard
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Bouton de recherche */}
                <NativeButton
                    title={loading ? "Recherche en cours..." : "Rechercher"}
                    onPress={handleSearch}
                    variant="primary"
                    style={styles.searchButton}
                />
            </View>

            {/* Modal GPS */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsData || undefined}
                title={t('specializedSearch.selectionnerLaPositionGps')}
            />

            {/* ✅ NOUVEAU Phase 4.2: Modal filtres */}
            <SearchFilters
                visible={showFilters}
                onClose={() => setShowFilters(false)}
                onApply={(newFilters) => {
                    setFilters(newFilters);
                }}
                initialFilters={filters}
                specializedType={specializedType}
            />
        </KeyboardAwareScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        marginRight: 16,
        padding: 8,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    serviceIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    serviceTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    serviceSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    formContainer: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: '#F9FAFB',
        minHeight: 100,
        textAlignVertical: 'top',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        backgroundColor: '#F9FAFB',
        gap: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    radiusSelector: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    radiusButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    radiusButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    radiusButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    radiusButtonTextActive: {
        color: '#FFFFFF',
    },
    momentSelector: {
        flexDirection: 'row',
        gap: 12,
    },
    momentButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        gap: 8,
    },
    momentButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    momentButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    momentButtonTextActive: {
        color: '#FFFFFF',
    },
    searchButton: {
        marginTop: 8,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.error,
        textAlign: 'center',
        margin: 20,
    },
    filtersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    filtersTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    filtersButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        backgroundColor: '#EEF2FF',
    },
    filtersButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    searchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
});

export default SpecializedSearchScreen;

