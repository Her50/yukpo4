// ✅ Écran de suivi en temps réel du chauffeur taxi
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { Share } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const { width, height } = Dimensions.get('window');

interface RouteParams {
    taxiId: number;
    bookingId?: number;
    depart?: string;
    destination?: string;
}

interface DriverLocation {
    latitude: number;
    longitude: number;
    heading?: number;
}

const TaxiTrackingScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { location: userLocation } = useLocation();
    const params = (route.params as any) as RouteParams;

    const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
    const [loading, setLoading] = useState(true);
    const [estimatedArrival, setEstimatedArrival] = useState<number | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [status, setStatus] = useState<'waiting' | 'coming' | 'arrived' | 'on_way'>('waiting');
    const mapRef = useRef<MapView>(null);
    const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [shareUrl, setShareUrl] = useState<string | null>(null);

    useEffect(() => {
        startTracking();
        return () => {
            if (trackingIntervalRef.current) {
                clearInterval(trackingIntervalRef.current);
            }
        };
    }, []);

    const startTracking = async () => {
        try {
            setLoading(true);
            await fetchDriverLocation();

            // ✅ Polling toutes les 2 secondes pour mettre à jour la position (suivi temps réel)
            trackingIntervalRef.current = setInterval(async () => {
                await fetchDriverLocation();
            }, 2000);
        } catch (error: any) {
            console.error('[TaxiTrackingScreen] Erreur démarrage suivi:', error);
            Alert.alert(t('message.error'), t('taxiTrackingScreen.impossibleDeDemarrerLeSuivi'));
        } finally {
            setLoading(false);
        }
    };

    /** ETA réel via OSRM (open source, gratuit, pas de clé API) */
    const fetchRealETA = async (
        fromLat: number, fromLng: number,
        toLat: number, toLng: number
    ): Promise<number | null> => {
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
            const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
            const json = await res.json();
            if (json?.routes?.[0]?.duration) {
                return Math.round(json.routes[0].duration / 60); // secondes → minutes
            }
        } catch { /* fallback ci-dessous */ }
        return null;
    };

    const fetchDriverLocation = async () => {
        try {
            const response = await apiGet(`/api/taxis/${params.taxiId}/location`);
            const r = response.data as any;
            if (response.success && r) {
                const loc = r;
                const newDriverLoc = {
                    latitude: loc.latitude || loc.lat,
                    longitude: loc.longitude || loc.lng,
                    heading: loc.heading,
                };
                setDriverLocation(newDriverLoc);

                // Calculer distance + ETA réel via OSRM
                if (userLocation?.coords) {
                    const dist = calculateDistance(
                        userLocation.coords.latitude,
                        userLocation.coords.longitude,
                        newDriverLoc.latitude,
                        newDriverLoc.longitude
                    );
                    setDistance(dist);

                    // Essai OSRM, fallback Haversine avec facteur trafic
                    const osrmEta = await fetchRealETA(
                        newDriverLoc.latitude, newDriverLoc.longitude,
                        userLocation.coords.latitude, userLocation.coords.longitude,
                    );
                    if (osrmEta !== null) {
                        setEstimatedArrival(osrmEta);
                    } else {
                        const hour = new Date().getHours();
                        const trafficFactor = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19) ? 0.6 : 0.8;
                        const avgSpeed = 30 * trafficFactor;
                        setEstimatedArrival(Math.round((dist / avgSpeed) * 60));
                    }
                }

                // Mettre à jour le statut
                if (loc.status) {
                    setStatus(loc.status);
                }

                // Centrer la carte sur le chauffeur
                if (mapRef.current) {
                    mapRef.current.animateToRegion({
                        latitude: newDriverLoc.latitude,
                        longitude: newDriverLoc.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }, 1000);
                }
            }
        } catch (error: any) {
            console.error('[TaxiTrackingScreen] Erreur récupération position:', error);
        }
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const formatDistance = (km: number): string => {
        if (km < 1) return `${Math.round(km * 1000)}m`;
        return `${km.toFixed(1)} km`;
    };

    const formatTime = (minutes: number): string => {
        if (minutes < 1) return t('taxiTrackingScreen.arrive');
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h${mins > 0 ? mins : ''}`;
    };

    const getStatusText = (): string => {
        switch (status) {
            case 'waiting': return t('taxiTrackingScreen.enAttente');
            case 'coming': return t('taxiTrackingScreen.enRouteVersVous');
            case 'arrived': return t('taxiTrackingScreen.arrive');
            case 'on_way': return t('taxiTrackingScreen.enRouteVersDestination');
            default: return t('taxiTrackingScreen.enCours');
        }
    };

    const handleShareLocation = async () => {
        try {
            if (!params.bookingId) {
                Alert.alert('Partage', 'Numéro de réservation requis pour partager.');
                return;
            }
            let url = shareUrl;
            if (!url) {
                const res = await apiPost(`/api/reservations/${params.bookingId}/share`, {});
                const data = (res?.data || res) as any;
                if (data?.success) {
                    url = data.share?.share_url;
                    setShareUrl(url ?? null);
                }
            }
            if (url) {
                await Share.share({
                    message: `Suivez mon taxi en temps réel :\n${url}`,
                    title: 'Suivre mon trajet Yukpo',
                });
            }
        } catch { }
    };

    const getStatusColor = (): string => {
        switch (status) {
            case 'waiting': return '#F59E0B';
            case 'coming': return '#06B6D4';
            case 'arrived': return '#10B981';
            case 'on_way': return '#3B82F6';
            default: return '#6B7280';
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        hapticPress();
                        navigation.goBack();
                    }}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>{t('taxiTracking.suiviDuTaxi')}</Text>
                    <Text style={styles.headerSubtitle}>{getStatusText()}</Text>
                </View>
            </View>

            {/* Carte */}
            <View style={styles.mapContainer}>
                {loading && !driverLocation ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>{t('taxiTracking.chargementDeLaPosition')}</Text>
                    </View>
                ) : (
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={{
                            latitude: driverLocation?.latitude || userLocation?.coords.latitude || 0,
                            longitude: driverLocation?.longitude || userLocation?.coords.longitude || 0,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }}
                        showsUserLocation={true}
                        showsMyLocationButton={true}
                    >
                        {/* Marqueur position utilisateur */}
                        {userLocation?.coords && (
                            <Marker
                                coordinate={{
                                    latitude: userLocation.coords.latitude,
                                    longitude: userLocation.coords.longitude,
                                }}
                                title={t('taxiTracking.votrePosition')}
                                pinColor="#06B6D4"
                            />
                        )}

                        {/* Marqueur position chauffeur */}
                        {driverLocation && (
                            <Marker
                                coordinate={{
                                    latitude: driverLocation.latitude,
                                    longitude: driverLocation.longitude,
                                }}
                                title={t('taxiTrackingScreen.taxi')}
                                description={t('taxiTrackingScreen.votreChauffeur')}
                                anchor={{ x: 0.5, y: 0.5 }}
                            >
                                <View style={styles.driverMarker}>
                                    <SafeIcon name="car" size={32} color="#FFFFFF" type="lucide" />
                                </View>
                            </Marker>
                        )}

                        {/* Ligne entre utilisateur et chauffeur */}
                        {userLocation?.coords && driverLocation && (
                            <Polyline
                                coordinates={[
                                    {
                                        latitude: userLocation.coords.latitude,
                                        longitude: userLocation.coords.longitude,
                                    },
                                    {
                                        latitude: driverLocation.latitude,
                                        longitude: driverLocation.longitude,
                                    },
                                ]}
                                strokeColor="#06B6D4"
                                strokeWidth={3}
                                lineDashPattern={[5, 5]}
                            />
                        )}
                    </MapView>
                )}
            </View>

            {/* Panneau d'information */}
            <View style={styles.infoPanel}>
                <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                    <Text style={styles.statusText}>{getStatusText()}</Text>
                </View>

                <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                        <SafeIcon name="map-pin" size={20} color="#6B7280" type="lucide" />
                        <Text style={styles.infoLabel}>{t('taxiTrackingScreen.distance')}</Text>
                        <Text style={styles.infoValue}>
                            {distance !== null ? formatDistance(distance) : '--'}
                        </Text>
                    </View>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoItem}>
                        <SafeIcon name="clock" size={20} color="#6B7280" type="lucide" />
                        <Text style={styles.infoLabel}>{t('taxiTracking.arriveeEstimee')}</Text>
                        <Text style={styles.infoValue}>
                            {estimatedArrival !== null ? formatTime(estimatedArrival) : '--'}
                        </Text>
                    </View>
                </View>

                {params.depart && params.destination && (
                    <View style={styles.routeInfo}>
                        <View style={styles.routePoint}>
                            <View style={styles.routeDot} />
                            <Text style={styles.routeText} numberOfLines={1}>{params.depart}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routePoint}>
                            <View style={[styles.routeDot, styles.routeDotDest]} />
                            <Text style={styles.routeText} numberOfLines={1}>{params.destination}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                        style={[styles.callButton, { flex: 1 }]}
                        onPress={() => {
                            hapticPress();
                            Alert.alert(t('taxiTrackingScreen.appeler'), t('taxiTrackingScreen.fonctionnaliteAppelAVenir'));
                        }}
                    >
                        <SafeIcon name="phone" size={20} color="#FFFFFF" type="lucide" />
                        <Text style={styles.callButtonText}>{t('taxiTrackingScreen.appelerLeChauffeur')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.shareButton}
                        onPress={() => { hapticPress(); handleShareLocation(); }}
                    >
                        <SafeIcon name="share-2" size={20} color="#FFFFFF" type="lucide" />
                        <Text style={styles.callButtonText}>Partager</Text>
                    </TouchableOpacity>
                </View>

                {/* Bouton paiement fin de course */}
                <TouchableOpacity
                    style={styles.payButton}
                    onPress={() => {
                        hapticPress();
                        (navigation as any).navigate('PaiementCourse', {
                            rideId: params?.rideId,
                            taxiId: params?.taxiId,
                            departure: params?.departure,
                            destination: params?.destination,
                            estimatedFare: params?.estimatedFare,
                            driverName: params?.driverName,
                        });
                    }}
                >
                    <SafeIcon name="credit-card" size={20} color="#FFFFFF" type="lucide" />
                    <Text style={styles.payButtonText}>Payer la course</Text>
                </TouchableOpacity>
            </View>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    mapContainer: {
        flex: 1,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    driverMarker: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#06B6D4',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    infoPanel: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    infoItem: {
        flex: 1,
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    infoDivider: {
        width: 1,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 16,
    },
    routeInfo: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    routeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#06B6D4',
    },
    routeDotDest: {
        backgroundColor: '#EF4444',
    },
    routeText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    routeLine: {
        width: 2,
        height: 20,
        backgroundColor: '#E5E7EB',
        marginLeft: 5,
        marginVertical: 4,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#10B981',
        borderRadius: 12,
        paddingVertical: 14,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#6366F1',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 18,
    },
    callButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#F59E0B',
        borderRadius: 12,
        paddingVertical: 15,
        marginTop: 10,
    },
    payButtonText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});

export default TaxiTrackingScreen;

