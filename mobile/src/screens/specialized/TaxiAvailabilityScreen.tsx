// ✅ Phase 4: Mise à jour disponibilité d'un taxi
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface TaxiAvailabilityScreenParams {
    taxiId: number;
}

const TaxiAvailabilityScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const params = route.params as TaxiAvailabilityScreenParams;

    const [taxi, setTaxi] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAvailableNow, setIsAvailableNow] = useState(true);
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);

    useEffect(() => {
        loadTaxiDetails();
    }, []);

    // Initialiser GPS avec position actuelle si disponible
    useEffect(() => {
        if (location?.coords && !gpsData) {
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            setGpsString(`${lat},${lng}`);
            setGpsData({ lat, lng });
        }
    }, [location]);

    const loadTaxiDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/taxis/${params.taxiId}`);

            const r = response.data as any;
            if (response.success && r) {
                const taxiData = r;
                setTaxi(taxiData);
                setIsAvailableNow(taxiData.is_available_now || false);

                if (taxiData.gps_actuel) {
                    setGpsString(taxiData.gps_actuel);
                    const [lat, lng] = taxiData.gps_actuel.split(',').map(parseFloat);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        setGpsData({ lat, lng });
                    }
                }
            } else {
                Alert.alert(t('message.error'), t('taxiAvailability.cannotLoadDetails'));
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[TaxiAvailabilityScreen] Erreur:', error);
            Alert.alert(t('message.error'), error.message || t('taxiAvailability.cannotLoad'));
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleGPSSelect = (coordinates: string) => {
        setGpsString(coordinates);
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
            setGpsData({ lat, lng });
        }
        setShowGPSModal(false);
    };

    const handleSave = async () => {
        if (!user) {
            Alert.alert(t('message.error'), t('taxiAvailability.mustBeConnected'));
            return;
        }

        try {
            setSaving(true);
            const payload: any = {};

            if (isAvailableNow !== taxi?.is_available_now) {
                payload.is_available_now = isAvailableNow;
            }

            if (gpsString && gpsString !== taxi?.gps_actuel) {
                payload.gps_actuel = gpsString;
            }

            if (Object.keys(payload).length === 0) {
                Alert.alert(t('message.info'), t('taxiAvailability.noChanges'));
                return;
            }

            const response = await apiPost(`/api/taxis/${params.taxiId}/update-availability`, payload);

            if (response.success) {
                Alert.alert(t('message.success'), t('taxiAvailability.availabilityUpdated'), [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack(),
                    },
                ]);
            } else {
                Alert.alert(t('message.error'), response.error || t('taxiAvailability.cannotUpdate'));
            }
        } catch (error: any) {
            console.error('[TaxiAvailabilityScreen] Erreur sauvegarde:', error);
            Alert.alert(t('message.error'), error.message || t('taxiAvailability.cannotUpdate'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('taxiAvailability.chargement')}</Text>
            </View>
        );
    }

    if (!taxi) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{t('taxiAvailability.taxiNonTrouve')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('taxiAvailability.mettreAJourDisponibilite')}</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Taxi: {taxi.zone}</Text>
                    {taxi.type_vehicule && (
                        <Text style={styles.cardSubtitle}>{taxi.type_vehicule}</Text>
                    )}
                </NativeCard>

                <NativeCard style={styles.card}>
                    <View style={styles.switchRow}>
                        <View style={styles.switchInfo}>
                            <Text style={styles.switchLabel}>{t('taxiAvailability.disponibleMaintenant')}</Text>
                            <Text style={styles.switchDescription}>
                                Activez cette option si votre taxi est disponible pour des courses
                            </Text>
                        </View>
                        <Switch
                            value={isAvailableNow}
                            onValueChange={setIsAvailableNow}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary + '80' }}
                            thumbColor={isAvailableNow ? modernColors.primary : '#F3F4F6'}
                        />
                    </View>
                </NativeCard>

                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('taxiAvailability.positionGpsActuelle')}</Text>
                    <Text style={styles.sectionDescription}>
                        Mettez à jour votre position GPS pour que les clients puissent vous trouver facilement
                    </Text>

                    <TouchableOpacity
                        style={styles.gpsButton}
                        onPress={() => setShowGPSModal(true)}
                    >
                        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                        <View style={styles.gpsButtonContent}>
                            <Text style={styles.gpsButtonText}>
                                {gpsString || t('taxiAvailability.selectionnerUnPointGps')}
                            </Text>
                            <Text style={styles.gpsButtonSubtext}>
                                {gpsString ? 'Appuyez pour modifier' : t('taxiAvailabilityScreen.appuyezPourSelectionner')}
                            </Text>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                    </TouchableOpacity>

                    {gpsString && (
                        <TouchableOpacity
                            style={styles.useCurrentLocationButton}
                            onPress={() => {
                                if (location?.coords) {
                                    const lat = location.coords.latitude;
                                    const lng = location.coords.longitude;
                                    setGpsString(`${lat},${lng}`);
                                    setGpsData({ lat, lng });
                                } else {
                                    Alert.alert(t('message.error'), t('taxiAvailability.gpsUnavailable'));
                                }
                            }}
                        >
                            <SafeIcon name="navigation" size={16} color={modernColors.primary} />
                            <Text style={styles.useCurrentLocationText}>
                                Utiliser ma position actuelle
                            </Text>
                        </TouchableOpacity>
                    )}
                </NativeCard>

                <NativeButton
                    title={t('taxiAvailabilityScreen.enregistrerLesModifications')}
                    onPress={handleSave}
                    disabled={saving}
                    icon="save"
                    variant="primary"
                    style={styles.saveButton}
                />
            </ScrollView>

            {/* Modal GPS */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsData || undefined}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    card: {
        padding: 20,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    switchInfo: {
        flex: 1,
        marginRight: 16,
    },
    switchLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    switchDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        gap: 12,
    },
    gpsButtonContent: {
        flex: 1,
    },
    gpsButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 4,
    },
    gpsButtonSubtext: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    useCurrentLocationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    useCurrentLocationText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.primary,
    },
    saveButton: {
        marginTop: 8,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: '#DC2626',
    },
});

export default TaxiAvailabilityScreen;

