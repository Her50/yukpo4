import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Vibration,
} from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const POLL_INTERVAL = 5000; // 5 secondes

interface PendingRide {
    ride_id: number;
    statut: string;
    tarif_estime: number | null;
    distance_km: number | null;
    duree_estimee_min: number | null;
    pickup_address: string | null;
    dest_address: string | null;
    pickup_lat: number | null;
    pickup_lon: number | null;
    dest_lat: number | null;
    dest_lon: number | null;
    vehicle_type: string | null;
    notes: string | null;
    taxi_id: number;
    passenger_phone: string | null;
    created_at: string;
}

const TaxiDriverRideRequestScreen: React.FC = () => {
    const navigation = useNavigation();
    const [rides, setRides] = useState<PendingRide[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<number | null>(null); // ride_id en cours

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const bellAnim = useRef(new Animated.Value(0)).current;
    const prevCount = useRef(0);

    const ringBell = useCallback(() => {
        Vibration.vibrate([0, 200, 100, 200]);
        Animated.sequence([
            Animated.timing(bellAnim, { toValue: 1, duration: 150, easing: Easing.ease, useNativeDriver: true }),
            Animated.timing(bellAnim, { toValue: -1, duration: 150, easing: Easing.ease, useNativeDriver: true }),
            Animated.timing(bellAnim, { toValue: 1, duration: 150, easing: Easing.ease, useNativeDriver: true }),
            Animated.timing(bellAnim, { toValue: 0, duration: 150, easing: Easing.ease, useNativeDriver: true }),
        ]).start();
    }, [bellAnim]);

    const fetchPending = useCallback(async () => {
        try {
            const res = await apiGet('/api/taxis/driver/pending-rides');
            const data: PendingRide[] = res?.data ?? [];
            setRides(data);
            if (data.length > prevCount.current) {
                ringBell();
            }
            prevCount.current = data.length;
        } catch { /* ignorer les erreurs réseau */ }
        finally { setLoading(false); }
    }, [ringBell]);

    useEffect(() => {
        fetchPending();
        pollRef.current = setInterval(fetchPending, POLL_INTERVAL);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [fetchPending]);

    const handleAccept = async (ride: PendingRide) => {
        setProcessing(ride.ride_id);
        try {
            await apiPost(`/api/taxis/rides/${ride.ride_id}/accept`, {});
            setRides(prev => prev.filter(r => r.ride_id !== ride.ride_id));
            prevCount.current = Math.max(0, prevCount.current - 1);
            Alert.alert(
                'Course acceptée !',
                'Le passager a été notifié. Rendez-vous au point de départ.',
                [{
                    text: 'Suivre la course',
                    onPress: () => (navigation as any).navigate('TaxiTracking', {
                        rideId: ride.ride_id,
                        taxiId: ride.taxi_id,
                        departure: ride.pickup_address,
                        destination: ride.dest_address,
                    }),
                }],
            );
        } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Impossible d\'accepter la course.');
        } finally {
            setProcessing(null);
        }
    };

    const handleRefuse = (ride: PendingRide) => {
        Alert.alert(
            'Refuser la course ?',
            'Le passager sera informé et pourra trouver un autre chauffeur.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Refuser',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessing(ride.ride_id);
                        try {
                            await apiPost(`/api/taxis/rides/${ride.ride_id}/refuse`, {
                                raison: 'Refus chauffeur',
                            });
                            setRides(prev => prev.filter(r => r.ride_id !== ride.ride_id));
                            prevCount.current = Math.max(0, prevCount.current - 1);
                        } catch (e: any) {
                            Alert.alert('Erreur', e?.message || 'Impossible de refuser.');
                        } finally {
                            setProcessing(null);
                        }
                    },
                },
            ],
        );
    };

    const bellRotate = bellAnim.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-20deg', '0deg', '20deg'],
    });

    const renderRide = ({ item }: { item: PendingRide }) => {
        const isProcessing = processing === item.ride_id;
        const ago = Math.round((Date.now() - new Date(item.created_at).getTime()) / 1000);
        const agoLabel = ago < 60 ? `il y a ${ago}s` : `il y a ${Math.round(ago / 60)}min`;

        return (
            <View style={styles.rideCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NOUVELLE COURSE</Text>
                    </View>
                    <Text style={styles.agoLabel}>{agoLabel}</Text>
                </View>

                {/* Itinéraire */}
                <View style={styles.routeBox}>
                    <View style={styles.routeRow}>
                        <View style={styles.dotGreen} />
                        <Text style={styles.routeAddr} numberOfLines={2}>
                            {item.pickup_address || 'Départ'}
                        </Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                        <View style={styles.dotRed} />
                        <Text style={styles.routeAddr} numberOfLines={2}>
                            {item.dest_address || 'Arrivée'}
                        </Text>
                    </View>
                </View>

                {/* Métriques */}
                <View style={styles.metricsRow}>
                    <View style={styles.metric}>
                        <SafeIcon name="map" size={14} color="#6B7280" />
                        <Text style={styles.metricVal}>
                            {item.distance_km ? `${item.distance_km.toFixed(1)} km` : '—'}
                        </Text>
                    </View>
                    <View style={styles.metric}>
                        <SafeIcon name="clock" size={14} color="#6B7280" />
                        <Text style={styles.metricVal}>
                            {item.duree_estimee_min ? `~${Math.round(item.duree_estimee_min)} min` : '—'}
                        </Text>
                    </View>
                    <View style={styles.metricFare}>
                        <SafeIcon name="dollar-sign" size={14} color={modernColors.primary} />
                        <Text style={styles.fareVal}>
                            {item.tarif_estime
                                ? `${item.tarif_estime.toLocaleString()} FCFA`
                                : '—'}
                        </Text>
                    </View>
                </View>

                {item.vehicle_type && item.vehicle_type !== 'standard' && (
                    <View style={styles.vehicleTag}>
                        <SafeIcon name="car" size={12} color={modernColors.primary} />
                        <Text style={styles.vehicleTagText}>
                            {item.vehicle_type === 'confort' ? 'Confort (+30%)' :
                             item.vehicle_type === 'van' ? 'Van (+60%)' :
                             item.vehicle_type === 'moto' ? 'Moto (-30%)' :
                             item.vehicle_type}
                        </Text>
                    </View>
                )}

                {/* Reversement net chauffeur (85%) */}
                {item.tarif_estime != null && (
                    <View style={styles.reversementBox}>
                        <Text style={styles.reversementLabel}>Votre gain net :</Text>
                        <Text style={styles.reversementVal}>
                            {Math.round(item.tarif_estime * 0.85).toLocaleString()} FCFA
                        </Text>
                        <Text style={styles.reversementSub}>(85% du tarif passager)</Text>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.refuseBtn, isProcessing && styles.btnDisabled]}
                        onPress={() => handleRefuse(item)}
                        disabled={isProcessing}
                    >
                        <SafeIcon name="x" size={18} color="#DC2626" />
                        <Text style={styles.refuseBtnText}>Refuser</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.acceptBtn, isProcessing && styles.btnDisabled]}
                        onPress={() => handleAccept(item)}
                        disabled={isProcessing}
                    >
                        <SafeIcon name="check" size={18} color="#fff" />
                        <Text style={styles.acceptBtnText}>
                            {isProcessing ? 'En cours…' : 'Accepter'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
                        <SafeIcon name="bell" size={22} color={modernColors.primary} />
                    </Animated.View>
                    <Text style={styles.headerTitle}>Demandes de course</Text>
                </View>
                {rides.length > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{rides.length}</Text>
                    </View>
                )}
            </View>

            {/* Statut polling */}
            <View style={styles.statusBar}>
                <View style={styles.pulseDot} />
                <Text style={styles.statusText}>
                    Mise à jour en temps réel · toutes les 5s
                </Text>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>Chargement…</Text>
                </View>
            ) : rides.length === 0 ? (
                <View style={styles.centered}>
                    <SafeIcon name="inbox" size={56} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>Aucune demande en attente</Text>
                    <Text style={styles.emptyText}>
                        Les nouvelles courses apparaîtront ici automatiquement.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={rides}
                    keyExtractor={item => String(item.ride_id)}
                    renderItem={renderRide}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    backBtn: { padding: 4 },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginLeft: 8 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
    badge: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center',
    },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    statusBar: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#ECFDF5',
    },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
    statusText: { fontSize: 12, color: '#059669', fontWeight: '500' },
    list: { padding: 16, gap: 16 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
    emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
    // Card
    rideCard: {
        backgroundColor: '#fff', borderRadius: 20, padding: 20,
        gap: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.10, shadowRadius: 10, elevation: 6,
        borderLeftWidth: 4, borderLeftColor: modernColors.primary,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    newBadge: {
        backgroundColor: `${modernColors.primary}15`,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    newBadgeText: { fontSize: 11, fontWeight: '800', color: modernColors.primary, letterSpacing: 0.5 },
    agoLabel: { fontSize: 12, color: '#9CA3AF' },
    // Itinéraire
    routeBox: {
        backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, gap: 4,
    },
    routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    routeLine: { width: 2, height: 16, backgroundColor: '#E5E7EB', marginLeft: 5, marginVertical: 2 },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', marginTop: 3 },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginTop: 3 },
    routeAddr: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
    // Métriques
    metricsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
    metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metricVal: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
    metricFare: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
    fareVal: { fontSize: 16, fontWeight: '800', color: modernColors.primary },
    vehicleTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: `${modernColors.primary}10`,
        alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    vehicleTagText: { fontSize: 12, color: modernColors.primary, fontWeight: '600' },
    // Reversement
    reversementBox: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10,
    },
    reversementLabel: { fontSize: 13, color: '#6B7280' },
    reversementVal: { fontSize: 15, fontWeight: '800', color: '#059669' },
    reversementSub: { fontSize: 11, color: '#9CA3AF' },
    // Actions
    actions: { flexDirection: 'row', gap: 12 },
    refuseBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 13, borderRadius: 12,
        borderWidth: 1.5, borderColor: '#DC2626',
    },
    refuseBtnText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
    acceptBtn: {
        flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 13, borderRadius: 12,
        backgroundColor: '#059669',
    },
    acceptBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    btnDisabled: { opacity: 0.5 },
});

export default TaxiDriverRideRequestScreen;
