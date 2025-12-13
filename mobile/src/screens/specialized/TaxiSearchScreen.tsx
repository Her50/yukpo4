// ✅ Écran de recherche de taxis (Mobile) - VERSION REFONDUE
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface TaxiSearchFilters {
    zone?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    available_only?: boolean;
    type_vehicule?: string;
}

const TaxiSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    const [zone, setZone] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [maxDistance, setMaxDistance] = useState(50);
    const [availableOnly, setAvailableOnly] = useState(true);
    const [typeVehicule, setTypeVehicule] = useState<string>('');
    const [loading, setLoading] = useState(false);

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
        if (!zone.trim() && !gpsData) {
            Alert.alert('Erreur', 'Veuillez renseigner une zone ou sélectionner un point GPS');
            return;
        }

        const filters: TaxiSearchFilters = {};
        if (zone.trim()) filters.zone = zone.trim();
        if (gpsData) {
            filters.lat = gpsData.lat;
            filters.lng = gpsData.lng;
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (availableOnly) filters.available_only = true;
        if (typeVehicule) filters.type_vehicule = typeVehicule;

        navigation.navigate('TaxiList' as never, { filters } as never);
    };

    const typesVehicules = ['Berline', 'SUV', 'Van', 'Moto', 'Vélo'];

    // Recherches rapides spécifiques taxi
    const quickSearches = [
        {
            id: 'proche',
            title: 'Plus proche',
            icon: 'map-pin',
            description: 'Taxis à proximité',
            action: () => {
                hapticPress();
                setMaxDistance(10);
                setAvailableOnly(true);
            }
        },
        {
            id: 'disponible',
            title: 'Disponible',
            icon: 'check-circle',
            description: 'Taxis libres',
            action: () => {
                hapticPress();
                setAvailableOnly(true);
                setMaxDistance(20);
            }
        },
        {
            id: 'intelligent',
            title: 'Intelligent',
            icon: 'sparkles',
            description: 'Matching IA',
            action: () => {
                hapticPress();
                (navigation as any).navigate('TaxiIntelligentSearch');
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient cyan (transport) */}
            <LinearGradient
                colors={['#06B6D4', '#22D3EE']}
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
                            <SafeIcon name="car" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Rechercher un taxi</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez rapidement un taxi disponible près de chez vous
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
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
                                        color="#06B6D4"
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.quickSearchTitle}>{search.title}</Text>
                                <Text style={styles.quickSearchDescription}>{search.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Formulaire de recherche */}
                <View style={styles.searchFormCard}>
                    <Text style={styles.sectionTitle}>📍 Localisation</Text>
                    
                    {/* Zone */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="map" size={14} color={modernColors.primary} type="lucide" /> Zone / Quartier
                        </Text>
                        <NativeInput
                            value={zone}
                            onChangeText={setZone}
                            placeholder="Ex: Douala, Centre-ville"
                            autoCapitalize="words"
                        />
                    </View>

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
                                {gpsString || 'Utiliser ma position GPS'}
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

                    {/* Type véhicule */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="car" size={14} color={modernColors.primary} type="lucide" /> Type de véhicule
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                            <TouchableOpacity
                                style={[styles.chip, !typeVehicule && styles.chipActive]}
                                onPress={() => {
                                    hapticPress();
                                    setTypeVehicule('');
                                }}
                            >
                                <Text style={[styles.chipText, !typeVehicule && styles.chipTextActive]}>
                                    Tous
                                </Text>
                            </TouchableOpacity>
                            {typesVehicules.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, typeVehicule === type && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setTypeVehicule(typeVehicule === type ? '' : type);
                                    }}
                                >
                                    <Text style={[styles.chipText, typeVehicule === type && styles.chipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Options */}
                    <View style={styles.optionsSection}>
                        <Text style={styles.sectionTitle}>⚙️ Options de recherche</Text>
                        
                        <View style={styles.optionCard}>
                            <View style={styles.optionContent}>
                                <View style={styles.optionIconContainer}>
                                    <SafeIcon name="check-circle" size={20} color="#10B981" type="lucide" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Uniquement les taxis disponibles</Text>
                                    <Text style={styles.optionDescription}>
                                        Afficher seulement les taxis libres et disponibles maintenant
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

                    {/* Boutons recherche */}
                    <View style={styles.buttonsRow}>
                        <NativeButton
                            onPress={handleSearch}
                            disabled={loading}
                            style={[styles.searchButton, styles.searchButtonSecondary]}
                        >
                            <View style={styles.searchButtonContent}>
                                <SafeIcon name="search" size={18} color="#06B6D4" type="lucide" />
                                <Text style={styles.searchButtonTextSecondary}>
                                    {loading ? 'Recherche...' : 'Recherche classique'}
                                </Text>
                            </View>
                        </NativeButton>
                        <NativeButton
                            onPress={() => {
                                hapticPress();
                                (navigation as any).navigate('TaxiIntelligentSearch');
                            }}
                            style={styles.searchButton}
                        >
                            <View style={styles.searchButtonContent}>
                                <SafeIcon name="sparkles" size={18} color="#FFFFFF" type="lucide" />
                                <Text style={styles.searchButtonText}>
                                    Recherche intelligente
                                </Text>
                            </View>
                        </NativeButton>
                    </View>
                </View>

                {/* Info section */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color="#06B6D4" type="lucide" />
                        <Text style={styles.infoTitle}>💡 Bon à savoir</Text>
                    </View>
                    <Text style={styles.infoText}>
                        • La recherche intelligente utilise l'IA pour trouver le meilleur taxi selon vos préférences{'\n'}
                        • Les taxis disponibles sont mis à jour en temps réel{'\n'}
                        • Vous pouvez réserver directement depuis l'application{'\n'}
                        • Les tarifs sont estimés selon la distance et le type de véhicule
                    </Text>
                </View>
            </ScrollView>

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
        backgroundColor: '#CFFAFE',
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
        backgroundColor: '#06B6D4',
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
        backgroundColor: '#06B6D4',
        borderColor: '#06B6D4',
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
    buttonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    searchButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    searchButtonSecondary: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#06B6D4',
    },
    searchButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    searchButtonTextSecondary: {
        color: '#06B6D4',
        fontSize: 14,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: '#ECFEFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#A5F3FC',
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
        color: '#0E7490',
    },
    infoText: {
        fontSize: 13,
        color: '#0E7490',
        lineHeight: 20,
    },
});

export default TaxiSearchScreen;

