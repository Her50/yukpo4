// ✅ Écran de recherche d'hôpitaux (Mobile) - VERSION REFONDUE
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
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface HopitalSearchFilters {
    ville?: string;
    quartier?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    type_etablissement?: string;
    prestation?: string;
    specialites?: string[]; // ✅ NOUVEAU: Spécialités multiples
    banque_sang?: boolean; // ✅ NOUVEAU: Banque de sang
    urgences_24h?: boolean; // ✅ NOUVEAU: Urgences 24h/24
    rdv_en_ligne?: boolean; // ✅ NOUVEAU: RDV en ligne
    assurances_acceptees?: string[]; // ✅ NOUVEAU: Assurances acceptées
    urgences_only?: boolean;
    available_only?: boolean;
}

const HopitalSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { location } = useLocation();

    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [typeEtablissement, setTypeEtablissement] = useState<string>('');
    const [prestation, setPrestation] = useState<string>('');
    const [urgencesOnly, setUrgencesOnly] = useState(false);
    const [availableOnly, setAvailableOnly] = useState(true);
    const [loading, setLoading] = useState(false);
    // ✅ NOUVEAU: Filtres avancés
    const [selectedSpecialites, setSelectedSpecialites] = useState<string[]>([]);
    const [banqueSang, setBanqueSang] = useState(false);
    const [urgences24h, setUrgences24h] = useState(false);
    const [rdvEnLigne, setRdvEnLigne] = useState(false);
    const [selectedAssurances, setSelectedAssurances] = useState<string[]>([]);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Initialiser GPS avec position actuelle
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
        // ✅ RÉORIENTÉ: Priorité sur recherche de services médicaux plutôt que d'établissements
        // Si une spécialité ou prestation est sélectionnée, utiliser l'endpoint de recherche de services médicaux
        const serviceRecherche = prestation || (selectedSpecialites.length > 0 ? selectedSpecialites[0] : '');

        if (serviceRecherche.trim()) {
            const filters: HopitalSearchFilters = {
                prestation: serviceRecherche.trim(),
            };
            if (gpsData) {
                filters.lat = gpsData.lat;
                filters.lng = gpsData.lng;
            }
            if (maxDistance > 0) filters.max_distance_km = maxDistance;
            if (selectedSpecialites.length > 0) filters.specialites = selectedSpecialites;
            if (banqueSang) filters.banque_sang = true;
            if (urgences24h) filters.urgences_24h = true;
            if (rdvEnLigne) filters.rdv_en_ligne = true;
            if (availableOnly) filters.available_only = true;
            // Navigation vers recherche de services médicaux
            navigation.navigate('MedicalServicesList' as never, { filters } as never);
            return;
        }

        // Sinon, recherche classique d'établissements (secondaire)
        // GPS ou localisation optionnelle
        const filters: HopitalSearchFilters = {};
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (typeEtablissement) filters.type_etablissement = typeEtablissement;
        if (urgencesOnly) filters.urgences_only = true;
        if (availableOnly) filters.available_only = true;
        if (selectedSpecialites.length > 0) filters.specialites = selectedSpecialites;
        if (banqueSang) filters.banque_sang = true;
        if (urgences24h) filters.urgences_24h = true;
        if (rdvEnLigne) filters.rdv_en_ligne = true;
        if (selectedAssurances.length > 0) filters.assurances_acceptees = selectedAssurances;

        navigation.navigate('HopitalList' as never, { filters } as never);
    };

    const typesEtablissements = ['Hôpital', 'Clinique', 'Dispensaire', 'Centre de santé'];
    const prestations = [
        'Urgences', 'Consultation générale', 'Chirurgie', 'Maternité',
        'Pédiatrie', 'Cardiologie', 'Neurologie', 'Radiologie'
    ];
    // ✅ NOUVEAU: Spécialités médicales complètes
    const specialites = [
        'Médecine générale', 'Pédiatrie', 'Gynécologie', 'Cardiologie',
        'Chirurgie', 'Dentaire', 'Ophtalmologie', 'Dermatologie',
        'Neurologie', 'Orthopédie', 'Urologie', 'Oncologie',
        'Psychiatrie', 'Radiologie', 'Anesthésie', 'Réanimation'
    ];
    // ✅ NOUVEAU: Assurances acceptées
    const assurances = [
        'CNPS', 'CNSS', 'Assurance privée', 'Mutuelle',
        'Assurance internationale', 'Prise en charge étatique'
    ];

    // Recherches rapides spécifiques hôpitaux
    const quickSearches = [
        {
            id: 'urgences',
            title: 'Urgences',
            icon: 'alert-triangle',
            description: 'Service urgences',
            action: () => {
                hapticPress();
                setUrgencesOnly(true);
                setPrestation('Urgences');
                setAvailableOnly(true);
            }
        },
        {
            id: 'proche',
            title: 'Plus proche',
            icon: 'map-pin',
            description: 'À proximité',
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
                setAvailableOnly(true);
                // Note: Le filtre rdv_en_ligne sera géré côté backend
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient bleu (santé professionnelle) */}
            <LinearGradient
                colors={['#3B82F6', '#60A5FA']}
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
                            <SafeIcon name="hospital" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Rechercher un hôpital</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez rapidement un établissement de santé près de chez vous
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <KeyboardAwareScreen
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
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
                                        color="#3B82F6"
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.quickSearchTitle}>{search.title}</Text>
                                <Text style={styles.quickSearchDescription}>{search.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ✅ RÉORIENTÉ: Formulaire de recherche - Priorité sur services médicaux */}
                <View style={styles.searchFormCard}>
                    <Text style={styles.sectionTitle}>🏥 Recherche de services médicaux</Text>
                    <Text style={styles.sectionDescription}>
                        Recherchez un service médical spécifique (consultation, chirurgie, spécialité...)
                    </Text>

                    {/* Service médical recherché (PRIORITAIRE) */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="stethoscope" size={14} color={modernColors.primary} type="lucide" /> Service médical recherché *
                        </Text>
                        <NativeInput
                            value={prestation}
                            onChangeText={setPrestation}
                            placeholder="Ex: Consultation cardiologie, Chirurgie, Urgences..."
                            autoCapitalize="words"
                        />
                    </View>

                    {/* Localisation (optionnelle pour recherche de services) */}
                    <Text style={styles.sectionTitle}>📍 Localisation (optionnelle)</Text>
                    <Text style={styles.sectionDescription}>
                        Ajoutez votre position pour trouver des services à proximité
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
                            <SafeIcon name="building" size={14} color={modernColors.primary} type="lucide" /> Type d'établissement
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                            {typesEtablissements.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.chip,
                                        typeEtablissement === type && styles.chipActive
                                    ]}
                                    onPress={() => {
                                        hapticPress();
                                        setTypeEtablissement(typeEtablissement === type ? '' : type);
                                    }}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        typeEtablissement === type && styles.chipTextActive
                                    ]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Prestation médicale */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="stethoscope" size={14} color={modernColors.primary} type="lucide" /> Prestation médicale
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                            {prestations.map((prest) => (
                                <TouchableOpacity
                                    key={prest}
                                    style={[
                                        styles.chip,
                                        prestation === prest && styles.chipActive
                                    ]}
                                    onPress={() => {
                                        hapticPress();
                                        setPrestation(prestation === prest ? '' : prest);
                                    }}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        prestation === prest && styles.chipTextActive
                                    ]}>
                                        {prest}
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
                        <SafeIcon name={showAdvancedFilters ? "chevron-up" : "chevron-down"} size={20} color="#3B82F6" type="lucide" />
                        <Text style={styles.advancedFiltersButtonText}>
                            {showAdvancedFilters ? 'Masquer' : 'Afficher'} les filtres avancés
                        </Text>
                    </TouchableOpacity>

                    {/* ✅ NOUVEAU: Filtres avancés */}
                    {showAdvancedFilters && (
                        <View style={styles.advancedFiltersCard}>
                            {/* Spécialités multiples */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="list" size={14} color={modernColors.primary} type="lucide" /> Spécialités médicales
                                </Text>
                                <View style={styles.servicesGrid}>
                                    {specialites.map((spec) => {
                                        const isSelected = selectedSpecialites.includes(spec);
                                        return (
                                            <TouchableOpacity
                                                key={spec}
                                                style={[
                                                    styles.serviceChip,
                                                    isSelected && styles.serviceChipActive
                                                ]}
                                                onPress={() => {
                                                    hapticPress();
                                                    if (isSelected) {
                                                        setSelectedSpecialites(selectedSpecialites.filter(s => s !== spec));
                                                    } else {
                                                        setSelectedSpecialites([...selectedSpecialites, spec]);
                                                    }
                                                }}
                                            >
                                                <Text style={[
                                                    styles.serviceChipText,
                                                    isSelected && styles.serviceChipTextActive
                                                ]}>
                                                    {spec}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Assurances acceptées */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <SafeIcon name="shield" size={14} color={modernColors.primary} type="lucide" /> Assurances acceptées
                                </Text>
                                <View style={styles.servicesGrid}>
                                    {assurances.map((assurance) => {
                                        const isSelected = selectedAssurances.includes(assurance);
                                        return (
                                            <TouchableOpacity
                                                key={assurance}
                                                style={[
                                                    styles.serviceChip,
                                                    isSelected && styles.serviceChipActive
                                                ]}
                                                onPress={() => {
                                                    hapticPress();
                                                    if (isSelected) {
                                                        setSelectedAssurances(selectedAssurances.filter(a => a !== assurance));
                                                    } else {
                                                        setSelectedAssurances([...selectedAssurances, assurance]);
                                                    }
                                                }}
                                            >
                                                <Text style={[
                                                    styles.serviceChipText,
                                                    isSelected && styles.serviceChipTextActive
                                                ]}>
                                                    {assurance}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Options supplémentaires */}
                            <View style={styles.optionsSection}>
                                <View style={styles.optionCard}>
                                    <View style={styles.optionContent}>
                                        <View style={styles.optionIconContainer}>
                                            <SafeIcon name="droplet" size={20} color="#DC2626" type="lucide" />
                                        </View>
                                        <View style={styles.optionTextContainer}>
                                            <Text style={styles.optionTitle}>Banque de sang</Text>
                                            <Text style={styles.optionDescription}>
                                                Afficher seulement les établissements avec banque de sang
                                            </Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={banqueSang}
                                        onValueChange={(value) => {
                                            hapticPress();
                                            setBanqueSang(value);
                                        }}
                                        trackColor={{ false: '#D1D5DB', true: '#DC2626' }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <View style={styles.optionCard}>
                                    <View style={styles.optionContent}>
                                        <View style={styles.optionIconContainer}>
                                            <SafeIcon name="clock" size={20} color="#3B82F6" type="lucide" />
                                        </View>
                                        <View style={styles.optionTextContainer}>
                                            <Text style={styles.optionTitle}>Urgences 24h/24</Text>
                                            <Text style={styles.optionDescription}>
                                                Service d'urgences disponible en permanence
                                            </Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={urgences24h}
                                        onValueChange={(value) => {
                                            hapticPress();
                                            setUrgences24h(value);
                                        }}
                                        trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <View style={styles.optionCard}>
                                    <View style={styles.optionContent}>
                                        <View style={styles.optionIconContainer}>
                                            <SafeIcon name="calendar" size={20} color="#10B981" type="lucide" />
                                        </View>
                                        <View style={styles.optionTextContainer}>
                                            <Text style={styles.optionTitle}>RDV en ligne</Text>
                                            <Text style={styles.optionDescription}>
                                                Prise de rendez-vous disponible en ligne
                                            </Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={rdvEnLigne}
                                        onValueChange={(value) => {
                                            hapticPress();
                                            setRdvEnLigne(value);
                                        }}
                                        trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Options */}
                    <View style={styles.optionsSection}>
                        <Text style={styles.sectionTitle}>⚙️ Options de recherche</Text>

                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="alert-triangle" size={20} color="#EF4444" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Urgences disponibles uniquement</Text>
                                    <Text style={styles.optionDescription}>
                                        Afficher seulement les établissements avec service d'urgences
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={urgencesOnly}
                                onValueChange={(value) => {
                                    hapticPress();
                                    setUrgencesOnly(value);
                                }}
                                trackColor={{ false: '#D1D5DB', true: '#EF4444' }}
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
                        • Les urgences sont disponibles 24h/24 dans la plupart des hôpitaux{'\n'}
                        • Vérifiez les prestations disponibles avant de vous déplacer{'\n'}
                        • Certains établissements proposent la prise de rendez-vous en ligne{'\n'}
                        • En cas d'urgence vitale, appelez directement le 118
                    </Text>
                </View>
            </KeyboardAwareScreen>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                initialCoordinates={gpsString}
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
        backgroundColor: '#DBEAFE',
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
        backgroundColor: '#3B82F6',
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
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
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
        backgroundColor: '#3B82F6',
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
        color: '#3B82F6',
    },
    advancedFiltersCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
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
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
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

export default HopitalSearchScreen;

