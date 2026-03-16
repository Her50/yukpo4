// ✅ Écran de recherche de laboratoires (Mobile) - VERSION REFONDUE
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
import SafeIcon from '../../components/SafeIcon';
import { NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface LaboratoireSearchFilters {
    ville?: string;
    quartier?: string;
    service_type?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    prestation_analyse?: string;
    types_examens?: string[]; // ✅ NOUVEAU: Types d'examens multiples
    rdv_en_ligne?: boolean;
    available_only?: boolean;
}

const LaboratoireSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [serviceType, setServiceType] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [rdvEnLigne, setRdvEnLigne] = useState(false);
    const [prestationAnalyse, setPrestationAnalyse] = useState<string>('');
    const [availableOnly, setAvailableOnly] = useState(true);
    const [loading, setLoading] = useState(false);
    // ✅ NOUVEAU: Types d'examens et fonctionnalités avancées
    const [selectedTypesExamens, setSelectedTypesExamens] = useState<string[]>([]);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [showMyExaminations, setShowMyExaminations] = useState(false);

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
        // ✅ RÉORIENTÉ: Priorité sur recherche d'examens plutôt que de laboratoires
        // Si un type d'examen est sélectionné, utiliser l'endpoint de recherche d'examens
        if (selectedTypesExamens.length > 0 || prestationAnalyse.trim()) {
            const filters: LaboratoireSearchFilters = {};
            if (selectedTypesExamens.length > 0) filters.types_examens = selectedTypesExamens;
            if (prestationAnalyse.trim()) filters.prestation_analyse = prestationAnalyse.trim();
            if (gpsData) {
                filters.lat = gpsData.lat;
                filters.lng = gpsData.lng;
            }
            if (maxDistance > 0) filters.max_distance_km = maxDistance;
            if (rdvEnLigne) filters.rdv_en_ligne = true;
            if (availableOnly) filters.available_only = true;
            // Navigation vers recherche d'examens
            navigation.navigate('LaboratoireList' as never, { filters } as never);
            return;
        }

        // Sinon, recherche classique de laboratoires (secondaire)
        // GPS ou localisation optionnelle
        const filters: LaboratoireSearchFilters = {};
        if (serviceType.trim()) filters.service_type = serviceType.trim();
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (rdvEnLigne) filters.rdv_en_ligne = true;
        if (availableOnly) filters.available_only = true;

        navigation.navigate('LaboratoireList' as never, { filters } as never);
    };

    const typesEtablissement = ['Laboratoire', 'Centre d\'imagerie', 'Les deux'];
    const prestationsAnalyses = [
        'Biologie', 'Hématologie', 'Biochimie', 'Microbiologie',
        'Sérologie', 'Immunologie', 'Radiologie', 'Échographie'
    ];
    // ✅ NOUVEAU: Types d'examens détaillés
    const typesExamens = [
        'Analyse de sang', 'Analyse d\'urine', 'Analyse de selles',
        'Bilan lipidique', t('laboratoireSearchScreen.bilanHepatique'), 'Bilan rénal',
        t('laboratoireSearchScreen.glycemie'), 'Hémogramme', 'Coagulation',
        'Hormones', 'Vitamines', 'Sérologie',
        'Radiographie', 'Échographie', 'IRM', 'Scanner',
        'Mammographie', t('laboratoireSearchScreen.densitometrieOsseuse')
    ];

    // Recherches rapides spécifiques laboratoires
    const quickSearches = [
        {
            id: 'proche',
            title: 'Plus proche',
            icon: 'map-pin',
            description: t('laboratoireSearch.aProximite'),
            action: () => {
                hapticPress();
                setMaxDistance(15);
                setAvailableOnly(true);
            }
        },
        {
            id: 'rdv',
            title: 'RDV en ligne',
            icon: 'calendar',
            description: 'Prise de rendez-vous',
            action: () => {
                hapticPress();
                setRdvEnLigne(true);
                setAvailableOnly(true);
            }
        },
        {
            id: 'resultats',
            title: t('laboratoireSearch.resultatsEnLigne'),
            icon: 'file-text',
            description: 'Consultation digitale',
            action: () => {
                hapticPress();
                setAvailableOnly(true);
                // Note: Le filtre resultats_en_ligne sera géré côté backend
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient indigo (santé professionnelle) */}
            <LinearGradient
                colors={['#6366F1', '#818CF8']}
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
                            <SafeIcon name="flask" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>{t('laboratoireSearch.rechercherUnLaboratoire')}</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez rapidement un laboratoire d'analyses ou d'imagerie
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <KeyboardAwareScreen
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* ✅ NOUVEAU: Bouton mes examens */}
                <TouchableOpacity
                    style={styles.myExaminationsBanner}
                    onPress={() => {
                        hapticPress();
                        navigation.navigate('MyLabExaminations' as never);
                    }}
                >
                    <LinearGradient
                        colors={['#6366F1', '#818CF8']}
                        style={styles.myExaminationsBannerGradient}
                    >
                        <View style={styles.myExaminationsBannerContent}>
                            <View style={styles.myExaminationsBannerIcon}>
                                <SafeIcon name="file-text" size={24} color="#FFFFFF" type="lucide" />
                            </View>
                            <View style={styles.myExaminationsBannerText}>
                                <Text style={styles.myExaminationsBannerTitle}>{t('laboratoireSearch.mesExamens')}</Text>
                                <Text style={styles.myExaminationsBannerSubtitle}>
                                    Consulter mes résultats et analyses
                                </Text>
                            </View>
                            <SafeIcon name="chevron-right" size={20} color="#FFFFFF" type="lucide" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

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
                                        color="#6366F1"
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.quickSearchTitle}>{search.title}</Text>
                                <Text style={styles.quickSearchDescription}>{search.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ✅ RÉORIENTÉ: Formulaire de recherche - Priorité sur examens */}
                <View style={styles.searchFormCard}>
                    <Text style={styles.sectionTitle}>{t('laboratoireSearch.rechercheDexamens')}</Text>
                    <Text style={styles.sectionDescription}>
                        Recherchez un type d'examen médical spécifique
                    </Text>

                    {/* Type d'examen recherché (PRIORITAIRE) */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="microscope" size={14} color={modernColors.primary} type="lucide" />{t('laboratoireSearchScreen.typeDexamenRecherche')}
                        </Text>
                        <NativeInput
                            value={prestationAnalyse}
                            onChangeText={setPrestationAnalyse}
                            placeholder={t('laboratoireSearch.exAnalyseDeSangRadiographie')}
                            autoCapitalize="words"
                        />
                    </View>

                    {/* Localisation (optionnelle pour recherche d'examens) */}
                    <Text style={styles.sectionTitle}>{t('laboratoireSearch.localisationOptionnelle')}</Text>
                    <Text style={styles.sectionDescription}>
                        Ajoutez votre position pour trouver des examens à proximité
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

                    {/* Type établissement */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="building" size={14} color={modernColors.primary} type="lucide" />{t('laboratoireSearchScreen.typeDetablissement')}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                            <TouchableOpacity
                                style={[styles.chip, !serviceType && styles.chipActive]}
                                onPress={() => {
                                    hapticPress();
                                    setServiceType('');
                                }}
                            >
                                <Text style={[styles.chipText, !serviceType && styles.chipTextActive]}>
                                    Tous
                                </Text>
                            </TouchableOpacity>
                            {typesEtablissement.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, serviceType === type && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setServiceType(serviceType === type ? '' : type);
                                    }}
                                >
                                    <Text style={[styles.chipText, serviceType === type && styles.chipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Prestation d'analyse */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="test-tube" size={14} color={modernColors.primary} type="lucide" /> Type d'analyse
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                            <TouchableOpacity
                                style={[styles.chip, !prestationAnalyse && styles.chipActive]}
                                onPress={() => {
                                    hapticPress();
                                    setPrestationAnalyse('');
                                }}
                            >
                                <Text style={[styles.chipText, !prestationAnalyse && styles.chipTextActive]}>
                                    Toutes
                                </Text>
                            </TouchableOpacity>
                            {prestationsAnalyses.map((prestation) => (
                                <TouchableOpacity
                                    key={prestation}
                                    style={[styles.chip, prestationAnalyse === prestation && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setPrestationAnalyse(prestationAnalyse === prestation ? '' : prestation);
                                    }}
                                >
                                    <Text style={[styles.chipText, prestationAnalyse === prestation && styles.chipTextActive]}>
                                        {prestation}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* ✅ NOUVEAU: Bouton filtres avancés */}
                    <TouchableOpacity
                        style={styles.advancedFiltersButton}
                        onPress={() => {
                            hapticPress();
                            setShowAdvancedFilters(!showAdvancedFilters);
                        }}
                    >
                        <SafeIcon name={showAdvancedFilters ? "chevron-up" : "chevron-down"} size={20} color="#6366F1" type="lucide" />
                        <Text style={styles.advancedFiltersButtonText}>
                            {showAdvancedFilters ? 'Masquer' : 'Afficher'} les types d'examens
                        </Text>
                    </TouchableOpacity>

                    {/* ✅ NOUVEAU: Filtres avancés - Types d'examens */}
                    {showAdvancedFilters && (
                        <View style={styles.advancedFiltersCard}>
                            <Text style={styles.label}>
                                <SafeIcon name="list" size={14} color={modernColors.primary} type="lucide" /> Types d'examens disponibles
                            </Text>
                            <Text style={styles.advancedFiltersDescription}>
                                Sélectionnez les types d'examens que vous recherchez
                            </Text>
                            <View style={styles.servicesGrid}>
                                {typesExamens.map((type) => {
                                    const isSelected = selectedTypesExamens.includes(type);
                                    return (
                                        <TouchableOpacity
                                            key={type}
                                            style={[
                                                styles.serviceChip,
                                                isSelected && styles.serviceChipActive
                                            ]}
                                            onPress={() => {
                                                hapticPress();
                                                if (isSelected) {
                                                    setSelectedTypesExamens(selectedTypesExamens.filter(t => t !== type));
                                                } else {
                                                    setSelectedTypesExamens([...selectedTypesExamens, type]);
                                                }
                                            }}
                                        >
                                            <Text style={[
                                                styles.serviceChipText,
                                                isSelected && styles.serviceChipTextActive
                                            ]}>
                                                {type}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Options */}
                    <View style={styles.optionsSection}>
                        <Text style={styles.sectionTitle}>{t('laboratoireSearch.optionsDeRecherche')}</Text>

                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="calendar" size={20} color="#6366F1" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Rendez-vous en ligne</Text>
                                    <Text style={styles.optionDescription}>
                                        Laboratoires proposant la prise de rendez-vous en ligne
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={rdvEnLigne}
                                onValueChange={(value) => {
                                    hapticPress();
                                    setRdvEnLigne(value);
                                }}
                                trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
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
                        <SafeIcon name="info" size={20} color="#6366F1" type="lucide" />
                        <Text style={styles.infoTitle}>{t('laboratoireSearch.bonASavoir')}</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • Certains laboratoires proposent la consultation des résultats en ligne{'\n'}
                        • Vérifiez les horaires d'ouverture avant de vous déplacer{'\n'}
                        • La prise de rendez-vous en ligne permet d'éviter les files d'attente{'\n'}
                        • Les résultats peuvent être disponibles sous 24-48h selon le type d'analyse
                    </Text>
                </View>
            </KeyboardAwareScreen>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsData || undefined}
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
        backgroundColor: '#EEF2FF',
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
        backgroundColor: '#6366F1',
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
    chipContainer: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
    },
    chipActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#FFFFFF',
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
        backgroundColor: '#6366F1',
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
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#C7D2FE',
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
        color: '#4338CA',
    },
    infoText: {
        fontSize: 13,
        color: '#4338CA',
        lineHeight: 20,
    },
    // ✅ NOUVEAU: Styles pour bannière mes examens
    myExaminationsBanner: {
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    myExaminationsBannerGradient: {
        padding: 16,
    },
    myExaminationsBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    myExaminationsBannerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    myExaminationsBannerText: {
        flex: 1,
    },
    myExaminationsBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    myExaminationsBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 16,
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
        color: '#6366F1',
    },
    advancedFiltersCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    advancedFiltersDescription: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 12,
        lineHeight: 16,
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
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
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    serviceChipText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    serviceChipTextActive: {
        color: '#FFFFFF',
    },
});

export default LaboratoireSearchScreen;

