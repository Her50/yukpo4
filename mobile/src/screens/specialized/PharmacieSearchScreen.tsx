// ✅ Écran de recherche de pharmacies (Mobile) - VERSION REFONDUE
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import PharmacyAIFeatures from '../../components/PharmacyAIFeatures';
import SafeIcon from '../../components/SafeIcon';
import { NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface PharmacieSearchFilters {
    ville?: string;
    quartier?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    on_duty_only?: boolean;
    available_only?: boolean;
    type_pharmacie?: string;
    services?: string[];
    livraison?: boolean;
    product_search?: string; // ✅ NOUVEAU: Recherche de produits
}

const PharmacieSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [onDutyOnly, setOnDutyOnly] = useState(false);
    const [availableOnly, setAvailableOnly] = useState(true);
    const [loading, setLoading] = useState(false);
    // ✅ NOUVEAU: Filtres avancés
    const [typePharmacie, setTypePharmacie] = useState<string>('');
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [livraison, setLivraison] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    // ✅ NOUVEAU: Modal fonctionnalités IA
    const [showAIFeatures, setShowAIFeatures] = useState(false);

    React.useEffect(() => {
        if (location?.coords) {
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            setGpsString(`${lat},${lng}`);
            setGpsData({ lat, lng });
        }
    }, [location]);

    const handleGPSSelect = (coordinates: string) => {
        setGpsString(coordinates);
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
            setGpsData({ lat, lng });
        }
        setShowGPSModal(false);
    };

    const handleSearch = () => {
        // ✅ RÉORIENTÉ: Priorité sur recherche de produits/services plutôt que d'établissements
        // Si recherche de produits, utiliser l'endpoint de recherche de produits
        if (productSearch.trim()) {
            const filters: PharmacieSearchFilters = {
                product_search: productSearch.trim(),
            };
            if (gpsData) {
                filters.lat = gpsData.lat;
                filters.lng = gpsData.lng;
            }
            if (maxDistance > 0) filters.max_distance_km = maxDistance;
            if (availableOnly) filters.available_only = true;
            // Navigation vers recherche de produits
            navigation.navigate('PharmacieList' as never, { filters } as never);
            return;
        }

        // Si recherche de pharmacie de garde, utiliser l'endpoint spécialisé
        if (onDutyOnly) {
            const filters: PharmacieSearchFilters = {
                on_duty_only: true,
            };
            if (gpsData) {
                filters.lat = gpsData.lat;
                filters.lng = gpsData.lng;
            }
            if (maxDistance > 0) filters.max_distance_km = maxDistance;
            // Navigation vers pharmacies de garde
            navigation.navigate('PharmacieList' as never, { filters } as never);
            return;
        }

        // Sinon, recherche classique d'établissements (secondaire)
        // GPS ou localisation optionnelle pour recherche d'établissements
        const filters: PharmacieSearchFilters = {};
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (availableOnly) filters.available_only = true;
        // ✅ Filtres avancés
        if (typePharmacie) filters.type_pharmacie = typePharmacie;
        if (selectedServices.length > 0) filters.services = selectedServices;
        if (livraison) filters.livraison = true;

        navigation.navigate('PharmacieList' as never, { filters } as never);
    };

    // ✅ RÉORIENTÉ: Recherches rapides - Priorité sur services/produits
    const quickSearches = [
        {
            id: 'produits',
            title: 'Recherche produits',
            icon: 'search',
            description: 'Médicaments disponibles',
            action: () => {
                hapticPress();
                setShowAdvancedFilters(true);
                // Focus sur recherche produits
            }
        },
        {
            id: 'garde',
            title: 'Pharmacie de garde',
            icon: 'clock',
            description: 'Disponible 24/7',
            action: () => {
                hapticPress();
                setOnDutyOnly(true);
                setAvailableOnly(true);
            }
        },
        {
            id: 'proche',
            title: 'À proximité',
            icon: 'map-pin',
            description: 'Produits près de moi',
            action: () => {
                hapticPress();
                setMaxDistance(10);
                setAvailableOnly(true);
            }
        },
    ];

    // ✅ NOUVEAU: Types de pharmacies
    const typesPharmacie = [
        { value: 'classique', label: 'Classique' },
        { value: 'garde', label: 'De garde' },
        { value: '24h', label: '24h/24' },
    ];

    // ✅ NOUVEAU: Services disponibles
    const servicesOptions = [
        { value: 'test_rapide', label: 'Tests rapides' },
        { value: 'vaccination', label: 'Vaccination' },
        { value: 'conseil', label: 'Conseil pharmaceutique' },
        { value: 'dermato', label: 'Produits dermatologiques' },
        { value: 'pediatrie', label: 'Pédiatrie' },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient */}
            <LinearGradient
                colors={['#EC4899', '#F472B6']}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            hapticPress();
                            navigation.goBack();
                        }}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={styles.headerIconContainer}>
                            <SafeIcon name="pill" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Rechercher une pharmacie</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez rapidement une pharmacie près de chez vous
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <KeyboardAwareScreen
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* ✅ NOUVEAU: Bouton fonctionnalités IA */}
                <View style={styles.aiFeaturesBanner}>
                    <LinearGradient
                        colors={['#EC4899', '#F472B6']}
                        style={styles.aiFeaturesBannerGradient}
                    >
                        <View style={styles.aiFeaturesBannerContent}>
                            <View style={styles.aiFeaturesBannerIcon}>
                                <SafeIcon name="sparkles" size={24} color="#FFFFFF" type="lucide" />
                            </View>
                            <View style={styles.aiFeaturesBannerText}>
                                <Text style={styles.aiFeaturesBannerTitle}>Fonctionnalités IA</Text>
                                <Text style={styles.aiFeaturesBannerSubtitle}>
                                    Interactions, dosage, budget, recherche produits
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.aiFeaturesBannerButton}
                                onPress={() => {
                                    hapticPress();
                                    setShowAIFeatures(true);
                                }}
                            >
                                <SafeIcon name="arrow-right" size={20} color="#EC4899" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* Recherches rapides */}
                <View style={styles.quickSearchesSection}>
                    <Text style={styles.sectionTitle}>🔍 Recherches rapides</Text>
                    <View style={styles.quickSearchesGrid}>
                        {quickSearches.map((search) => (
                            <TouchableOpacity
                                key={search.id}
                                style={styles.quickSearchCard}
                                onPress={search.action}
                                activeOpacity={0.7}
                            >
                                <View style={styles.quickSearchIconContainer}>
                                    <SafeIcon
                                        name={search.icon}
                                        size={24}
                                        color="#EC4899"
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.quickSearchTitle}>{search.title}</Text>
                                <Text style={styles.quickSearchDescription}>{search.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ✅ RÉORIENTÉ: Formulaire de recherche - Priorité sur produits/services */}
                <View style={styles.searchFormCard}>
                    <Text style={styles.sectionTitle}>🔍 Recherche de produits</Text>
                    <Text style={styles.sectionDescription}>
                        Recherchez des médicaments ou produits pharmaceutiques disponibles
                    </Text>

                    {/* Recherche de produits (PRIORITAIRE) */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="search" size={14} color={modernColors.primary} type="lucide" /> Nom du produit ou médicament *
                        </Text>
                        <NativeInput
                            value={productSearch}
                            onChangeText={setProductSearch}
                            placeholder="Ex: Paracétamol, Doliprane, Amoxicilline..."
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Localisation (optionnelle pour recherche de produits) */}
                    <Text style={styles.sectionTitle}>📍 Localisation (optionnelle)</Text>
                    <Text style={styles.sectionDescription}>
                        Ajoutez votre position pour trouver des produits à proximité
                    </Text>

                    {/* GPS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="map-pin" size={14} color={modernColors.primary} type="lucide" /> Position GPS
                        </Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => {
                                hapticPress();
                                setShowGPSModal(true);
                            }}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} type="lucide" />
                            <Text style={styles.gpsButtonText} numberOfLines={1}>
                                {gpsString || 'Utiliser ma position GPS (optionnel)'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    {/* Distance max */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="maximize-2" size={14} color={modernColors.primary} type="lucide" /> Distance maximale
                        </Text>
                        <View style={styles.distanceCard}>
                            <TouchableOpacity
                                style={styles.distanceButton}
                                onPress={() => {
                                    hapticPress();
                                    setMaxDistance(Math.max(5, maxDistance - 5));
                                }}
                            >
                                <SafeIcon name="minus" size={18} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                            <View style={styles.distanceValueContainer}>
                                <Text style={styles.distanceValue}>{maxDistance}</Text>
                                <Text style={styles.distanceUnit}>km</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.distanceButton}
                                onPress={() => {
                                    hapticPress();
                                    setMaxDistance(Math.min(200, maxDistance + 5));
                                }}
                            >
                                <SafeIcon name="plus" size={18} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ✅ NOUVEAU: Recherche de produits */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="pill" size={14} color={modernColors.primary} type="lucide" /> Rechercher un médicament/produit (optionnel)
                        </Text>
                        <NativeInput
                            value={productSearch}
                            onChangeText={setProductSearch}
                            placeholder="Ex: Paracétamol, Amoxicilline..."
                        />
                    </View>

                    {/* ✅ NOUVEAU: Bouton filtres avancés */}
                    <TouchableOpacity
                        style={styles.advancedFiltersButton}
                        onPress={() => {
                            hapticPress();
                            setShowAdvancedFilters(!showAdvancedFilters);
                        }}
                    >
                        <SafeIcon name={showAdvancedFilters ? "chevron-up" : "chevron-down"} size={20} color="#EC4899" type="lucide" />
                        <Text style={styles.advancedFiltersButtonText}>
                            {showAdvancedFilters ? 'Masquer' : 'Afficher'} les filtres avancés
                        </Text>
                    </TouchableOpacity>

                    {/* ✅ NOUVEAU: Filtres avancés */}
                    {showAdvancedFilters && (
                        <View style={styles.advancedFiltersCard}>
                            {/* Type de pharmacie */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="building" size={14} color={modernColors.primary} type="lucide" /> Type de pharmacie
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                                    {typesPharmacie.map((type) => (
                                        <TouchableOpacity
                                            key={type.value}
                                            style={[
                                                styles.chip,
                                                typePharmacie === type.value && styles.chipActive
                                            ]}
                                            onPress={() => {
                                                hapticPress();
                                                setTypePharmacie(typePharmacie === type.value ? '' : type.value);
                                            }}
                                        >
                                            <Text style={[
                                                styles.chipText,
                                                typePharmacie === type.value && styles.chipTextActive
                                            ]}>
                                                {type.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Services */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="list" size={14} color={modernColors.primary} type="lucide" /> Services disponibles
                                </Text>
                                <View style={styles.servicesGrid}>
                                    {servicesOptions.map((service) => {
                                        const isSelected = selectedServices.includes(service.value);
                                        return (
                                            <TouchableOpacity
                                                key={service.value}
                                                style={[
                                                    styles.serviceChip,
                                                    isSelected && styles.serviceChipActive
                                                ]}
                                                onPress={() => {
                                                    hapticPress();
                                                    if (isSelected) {
                                                        setSelectedServices(selectedServices.filter(s => s !== service.value));
                                                    } else {
                                                        setSelectedServices([...selectedServices, service.value]);
                                                    }
                                                }}
                                            >
                                                <Text style={[
                                                    styles.serviceChipText,
                                                    isSelected && styles.serviceChipTextActive
                                                ]}>
                                                    {service.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Livraison */}
                            <View style={styles.optionCard}>
                                <View style={styles.optionContent}>
                                    <View style={styles.optionIconContainer}>
                                        <SafeIcon name="truck" size={20} color="#10B981" type="lucide" />
                                    </View>
                                    <View style={styles.optionTextContainer}>
                                        <Text style={styles.optionTitle}>Livraison à domicile</Text>
                                        <Text style={styles.optionDescription}>
                                            Afficher seulement les pharmacies avec service de livraison
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={livraison}
                                    onValueChange={(value) => {
                                        hapticPress();
                                        setLivraison(value);
                                    }}
                                    trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>
                        </View>
                    )}

                    {/* Options */}
                    <View style={styles.optionsSection}>
                        <Text style={styles.sectionTitle}>⚙️ Options de recherche</Text>

                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="clock" size={20} color="#EC4899" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>De garde uniquement</Text>
                                    <Text style={styles.optionDescription}>
                                        Afficher seulement les pharmacies de garde (24/7)
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={onDutyOnly}
                                onValueChange={(value) => {
                                    hapticPress();
                                    setOnDutyOnly(value);
                                }}
                                trackColor={{ false: '#D1D5DB', true: '#EC4899' }}
                                thumbColor="#FFFFFF"
                            />
                        </View>

                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="check-circle" size={20} color="#10B981" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Disponibles maintenant</Text>
                                    <Text style={styles.optionDescription}>
                                        Filtrer selon les horaires d'ouverture actuels
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={availableOnly}
                                onValueChange={(value) => {
                                    hapticPress();
                                    setAvailableOnly(value);
                                }}
                                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>

                    {/* Bouton recherche */}
                    <TouchableOpacity
                        onPress={handleSearch}
                        disabled={loading}
                        style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                        activeOpacity={0.8}
                    >
                        <View style={styles.searchButtonContent}>
                            <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchButtonText}>
                                {loading ? 'Recherche en cours...' : 'Lancer la recherche'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color="#3B82F6" type="lucide" />
                        <Text style={styles.infoTitle}>💡 Bon à savoir</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Les pharmacies de garde sont disponibles 24h/24 et 7j/7{'\n'}
                        • Vous pouvez filtrer par distance pour trouver la plus proche{'\n'}
                        • Les horaires sont mis à jour en temps réel
                    </Text>
                </View>
            </KeyboardAwareScreen>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
            />

            {/* ✅ NOUVEAU: Modal fonctionnalités IA */}
            <PharmacyAIFeatures
                visible={showAIFeatures}
                onClose={() => setShowAIFeatures(false)}
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
    },
    backButton: {
        marginRight: 12,
        marginTop: 4,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    quickSearchesSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    sectionDescription: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 16,
        lineHeight: 18,
    },
    priceRangeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    priceInput: {
        flex: 1,
    },
    priceRangeSeparator: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
    },
    quickSearchesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickSearchCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    quickSearchIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickSearchTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
        textAlign: 'center',
    },
    quickSearchDescription: {
        fontSize: 11,
        color: '#6B7280',
        textAlign: 'center',
    },
    searchFormCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    distanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    distanceButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#EC4899',
        justifyContent: 'center',
        alignItems: 'center',
    },
    distanceValueContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    distanceUnit: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    optionsSection: {
        marginTop: 8,
        marginBottom: 8,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    optionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
    },
    searchButton: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#EC4899',
        paddingVertical: 16,
    },
    searchButtonDisabled: {
        opacity: 0.6,
    },
    searchButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E40AF',
    },
    infoText: {
        fontSize: 13,
        color: '#1E40AF',
        lineHeight: 20,
    },
    // ✅ NOUVEAU: Styles pour filtres avancés
    advancedFiltersButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 12,
        gap: 8,
    },
    advancedFiltersButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#EC4899',
    },
    advancedFiltersCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipContainer: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
    },
    chipActive: {
        backgroundColor: '#EC4899',
        borderColor: '#EC4899',
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    serviceChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    serviceChipActive: {
        backgroundColor: '#EC4899',
        borderColor: '#EC4899',
    },
    serviceChipText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    serviceChipTextActive: {
        color: '#FFFFFF',
    },
    // ✅ NOUVEAU: Styles pour bannière fonctionnalités IA
    aiFeaturesBanner: {
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    aiFeaturesBannerGradient: {
        padding: 16,
    },
    aiFeaturesBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    aiFeaturesBannerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiFeaturesBannerText: {
        flex: 1,
    },
    aiFeaturesBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    aiFeaturesBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 16,
    },
    aiFeaturesBannerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default PharmacieSearchScreen;

