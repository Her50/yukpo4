import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { NativeCard } from '../../components/SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const { width } = Dimensions.get('window');

interface RouteParams {
    packageId: string;
    deliveryUuid: string;
}

interface CourierPosition {
    latitude: number;
    longitude: number;
    heading?: number;
    updated_at?: string;
}

interface CourierInfo {
    name: string;
    phone: string;
    vehicle?: string;
    photo_url?: string;
}

interface LocationCoords {
    latitude: number;
    longitude: number;
    address?: string;
}

interface BookPackage {
    id: string;
    reference: string;
    status: string;
    succursale_label?: string;
    book_titles: string[];
    sender_name: string;
    recipient_name: string;
    sender_phone?: string;
    recipient_phone?: string;
    created_at?: string;
}

interface DeliveryDetails {
    uuid: string;
    status: string;
    eta_minutes?: number;
    pickup: LocationCoords;
    dropoff: LocationCoords;
    courier?: CourierInfo;
    courier_position?: CourierPosition;
}

type PackageStatus = 'constitue' | 'dispatche' | 'en_cours' | 'livre';

const STATUS_STEPS: { key: PackageStatus; icon: string }[] = [
    { key: 'constitue', icon: 'Package' },
    { key: 'dispatche', icon: 'Truck' },
    { key: 'en_cours', icon: 'Navigation' },
    { key: 'livre', icon: 'CheckCircle' },
];

const BookDeliveryTrackingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { t } = useLanguageSafe();
    const params = (route.params as any) as RouteParams;

    const [bookPackage, setBookPackage] = useState<BookPackage | null>(null);
    const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);
    const [courierPos, setCourierPos] = useState<CourierPosition | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const mapRef = useRef<MapView>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const fetchPackageDetails = useCallback(async () => {
        try {
            const res = await apiGet(`/api/bourse-livre/v2/packages/${params.packageId}`);
            if (res?.data) setBookPackage(res.data as BookPackage);
        } catch (e: any) {
            console.error('[BookDeliveryTracking] Package fetch error:', e);
        }
    }, [params.packageId]);

    const fetchDeliveryDetails = useCallback(async () => {
        try {
            const res = await apiGet(`/api/deliveries/${params.deliveryUuid}`);
            if (res?.data) {
                const d = res.data as DeliveryDetails;
                setDelivery(d);
                if (d.courier_position) setCourierPos(d.courier_position);
            }
        } catch (e: any) {
            console.error('[BookDeliveryTracking] Delivery fetch error:', e);
        }
    }, [params.deliveryUuid]);

    const fetchTrackingPosition = useCallback(async () => {
        try {
            const res = await apiGet(`/api/deliveries/${params.deliveryUuid}/tracking`);
            if (res?.data) {
                const pos = res.data as CourierPosition;
                setCourierPos(pos);
            }
        } catch (e: any) {
            console.error('[BookDeliveryTracking] Tracking poll error:', e);
        }
    }, [params.deliveryUuid]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError(null);
            try {
                await Promise.all([fetchPackageDetails(), fetchDeliveryDetails()]);
            } catch {
                setError(t('bookDeliveryTracking.loadError') || 'Impossible de charger les données');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [fetchPackageDetails, fetchDeliveryDetails, t]);

    useEffect(() => {
        pollingRef.current = setInterval(fetchTrackingPosition, 10000);
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [fetchTrackingPosition]);

    useEffect(() => {
        if (!delivery) return;
        const coords: { latitude: number; longitude: number }[] = [];
        if (delivery.pickup) coords.push(delivery.pickup);
        if (delivery.dropoff) coords.push(delivery.dropoff);
        if (courierPos) coords.push({ latitude: courierPos.latitude, longitude: courierPos.longitude });
        if (coords.length >= 2 && mapRef.current) {
            mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 60, right: 60, bottom: 200, left: 60 },
                animated: true,
            });
        }
    }, [delivery, courierPos]);

    const callCourier = () => {
        const phone = delivery?.courier?.phone;
        if (phone) Linking.openURL(`tel:${phone}`);
    };

    const getStatusIndex = (status?: string): number => {
        const idx = STATUS_STEPS.findIndex((s) => s.key === status);
        return idx >= 0 ? idx : 0;
    };

    const routeCoords = delivery
        ? [delivery.pickup, ...(courierPos ? [{ latitude: courierPos.latitude, longitude: courierPos.longitude }] : []), delivery.dropoff].filter(Boolean) as LocationCoords[]
        : [];

    if (loading) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('message.loading') || 'Chargement...'}</Text>
                </View>
            </SafeNativeView>
        );
    }

    if (error) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.centered}>
                    <SafeIcon name="AlertTriangle" size={48} color={modernColors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() => {
                            setLoading(true);
                            setError(null);
                            Promise.all([fetchPackageDetails(), fetchDeliveryDetails()])
                                .catch(() => setError(t('bookDeliveryTracking.loadError') || 'Erreur'))
                                .finally(() => setLoading(false));
                        }}
                    >
                        <Text style={styles.retryText}>{t('common.retry') || 'Réessayer'}</Text>
                    </TouchableOpacity>
                </View>
            </SafeNativeView>
        );
    }

    const currentStatusIdx = getStatusIndex(bookPackage?.status as PackageStatus);

    return (
        <SafeNativeView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="ArrowLeft" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('bookDeliveryTracking.title') || 'Suivi livraison livre'}</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    initialRegion={{
                        latitude: delivery?.pickup?.latitude ?? 5.95,
                        longitude: delivery?.pickup?.longitude ?? 10.15,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    showsUserLocation
                    showsMyLocationButton={false}
                >
                    {delivery?.pickup && (
                        <Marker
                            coordinate={delivery.pickup}
                            title={t('bookDeliveryTracking.pickup') || 'Point de retrait'}
                            pinColor={modernColors.info}
                        />
                    )}
                    {delivery?.dropoff && (
                        <Marker
                            coordinate={delivery.dropoff}
                            title={t('bookDeliveryTracking.dropoff') || 'Point de livraison'}
                            pinColor={modernColors.success}
                        />
                    )}
                    {courierPos && (
                        <Marker
                            coordinate={{ latitude: courierPos.latitude, longitude: courierPos.longitude }}
                            title={delivery?.courier?.name || t('bookDeliveryTracking.courier') || 'Coursier'}
                        >
                            <View style={styles.courierMarker}>
                                <SafeIcon name="Bike" size={20} color="#fff" />
                            </View>
                        </Marker>
                    )}
                    {routeCoords.length >= 2 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeColor={modernColors.primary}
                            strokeWidth={3}
                        />
                    )}
                </MapView>

                {delivery?.eta_minutes != null && (
                    <View style={styles.etaBadge}>
                        <SafeIcon name="Clock" size={14} color="#fff" />
                        <Text style={styles.etaText}>
                            {delivery.eta_minutes} {t('bookDeliveryTracking.minutes') || 'min'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Bottom panel */}
            <ScrollView style={styles.bottomPanel} contentContainerStyle={styles.bottomContent}>
                {/* Status timeline */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>
                        {t('bookDeliveryTracking.statusTitle') || 'Statut du colis'}
                    </Text>
                    <View style={styles.timeline}>
                        {STATUS_STEPS.map((step, idx) => {
                            const isActive = idx <= currentStatusIdx;
                            const isCurrent = idx === currentStatusIdx;
                            return (
                                <View key={step.key} style={styles.timelineStep}>
                                    <View style={styles.timelineIconRow}>
                                        <View style={[
                                            styles.timelineDot,
                                            isActive && styles.timelineDotActive,
                                            isCurrent && styles.timelineDotCurrent,
                                        ]}>
                                            <SafeIcon
                                                name={step.icon}
                                                size={16}
                                                color={isActive ? '#fff' : modernColors.textTertiary}
                                            />
                                        </View>
                                        {idx < STATUS_STEPS.length - 1 && (
                                            <View style={[
                                                styles.timelineLine,
                                                isActive && styles.timelineLineActive,
                                            ]} />
                                        )}
                                    </View>
                                    <Text style={[
                                        styles.timelineLabel,
                                        isActive && styles.timelineLabelActive,
                                    ]}>
                                        {t(`bookDeliveryTracking.status.${step.key}`) || step.key}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </NativeCard>

                {/* Package info */}
                {bookPackage && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>
                            {t('bookDeliveryTracking.packageInfo') || 'Détails du colis'}
                        </Text>
                        {!!bookPackage.succursale_label && (
                            <View style={styles.pickupTag}>
                                <SafeIcon name="MapPin" size={14} color="#0f766e" />
                                <Text style={styles.pickupTagText}>
                                    {`PICKUP: ${bookPackage.succursale_label}`}
                                </Text>
                            </View>
                        )}
                        <View style={styles.infoRow}>
                            <SafeIcon name="Hash" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.infoLabel}>{t('bookDeliveryTracking.reference') || 'Réf.'}</Text>
                            <Text style={styles.infoValue}>{bookPackage.reference}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <SafeIcon name="BookOpen" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.infoLabel}>{t('bookDeliveryTracking.books') || 'Livres'}</Text>
                            <Text style={styles.infoValue} numberOfLines={2}>
                                {bookPackage.book_titles?.join(', ') || '-'}
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <SafeIcon name="UserCheck" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.infoLabel}>{t('bookDeliveryTracking.sender') || 'Expéditeur'}</Text>
                            <Text style={styles.infoValue}>{bookPackage.sender_name}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <SafeIcon name="User" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.infoLabel}>{t('bookDeliveryTracking.recipient') || 'Destinataire'}</Text>
                            <Text style={styles.infoValue}>{bookPackage.recipient_name}</Text>
                        </View>
                    </NativeCard>
                )}

                {/* Courier info */}
                {delivery?.courier && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>
                            {t('bookDeliveryTracking.courierInfo') || 'Coursier'}
                        </Text>
                        <View style={styles.courierRow}>
                            <View style={styles.courierAvatar}>
                                <SafeIcon name="User" size={24} color={modernColors.primary} />
                            </View>
                            <View style={styles.courierDetails}>
                                <Text style={styles.courierName}>{delivery.courier.name}</Text>
                                {delivery.courier.vehicle && (
                                    <Text style={styles.courierVehicle}>
                                        <SafeIcon name="Bike" size={12} color={modernColors.textSecondary} />{' '}
                                        {delivery.courier.vehicle}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity style={styles.callBtn} onPress={callCourier}>
                                <SafeIcon name="Phone" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </NativeCard>
                )}
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        color: modernColors.textSecondary,
    },
    errorText: {
        marginTop: 12,
        fontSize: 15,
        color: modernColors.error,
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.surfaceVariant,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: modernColors.text,
    },
    mapContainer: {
        height: 280,
        position: 'relative',
    },
    map: {
        flex: 1,
    },
    courierMarker: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    etaBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    etaText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    bottomPanel: {
        flex: 1,
    },
    bottomContent: {
        padding: 16,
        paddingBottom: 32,
        gap: 12,
    },
    card: {
        padding: 16,
        borderRadius: 12,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
    },
    pickupTag: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: '#ccfbf1',
        borderColor: '#5eead4',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 10,
    },
    pickupTagText: {
        fontSize: 12,
        color: '#115e59',
        fontWeight: '800',
    },
    timeline: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    timelineStep: {
        alignItems: 'center',
        flex: 1,
    },
    timelineIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },
    timelineDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timelineDotActive: {
        backgroundColor: modernColors.success,
    },
    timelineDotCurrent: {
        backgroundColor: modernColors.primary,
        borderWidth: 2,
        borderColor: modernColors.primaryDark,
    },
    timelineLine: {
        flex: 1,
        height: 2,
        backgroundColor: modernColors.surfaceVariant,
        marginHorizontal: -4,
    },
    timelineLineActive: {
        backgroundColor: modernColors.success,
    },
    timelineLabel: {
        fontSize: 10,
        color: modernColors.textTertiary,
        marginTop: 4,
        textAlign: 'center',
    },
    timelineLabelActive: {
        color: modernColors.text,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        gap: 8,
    },
    infoLabel: {
        fontSize: 13,
        color: modernColors.textSecondary,
        width: 90,
    },
    infoValue: {
        fontSize: 13,
        color: modernColors.text,
        fontWeight: '500',
        flex: 1,
    },
    courierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    courierAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    courierDetails: {
        flex: 1,
    },
    courierName: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
    },
    courierVehicle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    callBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: modernColors.success,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default BookDeliveryTrackingScreen;
