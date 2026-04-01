import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, Animated, Easing } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

type RideStatus = 'pending' | 'accepted' | 'refused' | 'cancelled';

const POLL_INTERVAL = 4000; // 4 secondes

const TaxiRequestWaitingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const {
        rideId, taxiId,
        departure, destination,
        tarifEstime, distanceKm, dureeMin,
        driverName, driverPhone,
        pickupLat, pickupLon, destLat, destLon,
    } = route.params || {};

    const [status, setStatus] = useState<RideStatus>('pending');
    const [countdown, setCountdown] = useState(60); // 60s avant timeout
    const [driverInfo, setDriverInfo] = useState({ name: driverName, phone: driverPhone, gps: null as string | null });

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Animation pulsation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.ease, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, easing: Easing.ease, useNativeDriver: true }),
            ])
        ).start();

        // Polling statut
        pollRef.current = setInterval(pollStatus, POLL_INTERVAL);

        // Countdown
        countRef.current = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) {
                    clearAll();
                    setStatus('refused');
                    return 0;
                }
                return c - 1;
            });
        }, 1000);

        return clearAll;
    }, []);

    const clearAll = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (countRef.current) clearInterval(countRef.current);
    };

    const pollStatus = async () => {
        try {
            const res = await apiGet(`/api/taxis/rides/${rideId}/status`);
            const d = res?.data;
            if (!d) return;

            if (d.statut === 'accepted') {
                clearAll();
                setStatus('accepted');
                setDriverInfo({ name: d.driver_name, phone: d.driver_phone, gps: d.driver_gps });
            } else if (d.statut === 'refused' || d.statut === 'cancelled') {
                clearAll();
                setStatus('refused');
            }
        } catch { /* réseau — ignorer silencieusement */ }
    };

    const handleCancel = () => {
        Alert.alert('Annuler la demande ?', 'La demande sera annulée et le chauffeur sera notifié.', [
            { text: 'Non', style: 'cancel' },
            { text: 'Oui, annuler', style: 'destructive', onPress: async () => {
                clearAll();
                try {
                    await apiPost(`/api/taxis/rides/${rideId}/cancel`, {});
                } catch { }
                navigation.goBack();
            }},
        ]);
    };

    const handlePay = () => {
        (navigation as any).replace('PaiementCourse', {
            rideId, taxiId,
            departure, destination,
            estimatedFare: tarifEstime,
            estimatedDistance: distanceKm,
            pickupLat, pickupLon, destLat, destLon,
            driverName: driverInfo.name,
        });
    };

    const handleFindAnother = () => {
        navigation.goBack();
    };

    // ─── ACCEPTED ─────────────────────────────────────────────────────────────
    if (status === 'accepted') {
        return (
            <View style={styles.container}>
                <View style={styles.acceptedCard}>
                    <View style={styles.acceptedIcon}>
                        <SafeIcon name="check-circle" size={56} color="#059669" />
                    </View>
                    <Text style={styles.acceptedTitle}>Course acceptée !</Text>
                    <Text style={styles.acceptedSub}>Le chauffeur est en route vers vous.</Text>

                    <View style={styles.driverCard}>
                        <View style={styles.driverAvatar}>
                            <SafeIcon name="user" size={28} color={modernColors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.driverName}>{driverInfo.name || 'Votre chauffeur'}</Text>
                            {driverInfo.phone && <Text style={styles.driverPhone}>{driverInfo.phone}</Text>}
                        </View>
                        <View style={styles.verifiedBadge}>
                            <SafeIcon name="shield" size={14} color="#059669" />
                            <Text style={styles.verifiedText}>Vérifié</Text>
                        </View>
                    </View>

                    <View style={styles.tripSummary}>
                        <View style={styles.tripRow}><View style={styles.dotGreen} /><Text style={styles.tripAddr} numberOfLines={1}>{departure || 'Départ'}</Text></View>
                        <View style={styles.tripLine} />
                        <View style={styles.tripRow}><View style={styles.dotRed} /><Text style={styles.tripAddr} numberOfLines={1}>{destination || 'Arrivée'}</Text></View>
                        {distanceKm && <Text style={styles.tripMeta}>{distanceKm} km · ~{dureeMin} min · {(tarifEstime || 0).toLocaleString()} FCFA</Text>}
                    </View>

                    <TouchableOpacity style={styles.trackBtn} onPress={() => (navigation as any).navigate('TaxiTracking', { rideId, taxiId, departure, destination })}>
                        <SafeIcon name="map-pin" size={18} color="#fff" />
                        <Text style={styles.trackBtnText}>Suivre le chauffeur en direct</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.payNowBtn} onPress={handlePay}>
                        <SafeIcon name="credit-card" size={18} color={modernColors.primary} />
                        <Text style={styles.payNowBtnText}>Préparer le paiement</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ─── REFUSED / TIMEOUT ───────────────────────────────────────────────────
    if (status === 'refused') {
        return (
            <View style={styles.container}>
                <View style={styles.refusedCard}>
                    <SafeIcon name="x-circle" size={56} color="#DC2626" />
                    <Text style={styles.refusedTitle}>Course non acceptée</Text>
                    <Text style={styles.refusedSub}>
                        {countdown <= 0
                            ? "Le chauffeur n'a pas répondu dans le délai imparti."
                            : "Le chauffeur a refusé cette course."}
                    </Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={handleFindAnother}>
                        <SafeIcon name="search" size={18} color="#fff" />
                        <Text style={styles.retryBtnText}>Trouver un autre chauffeur</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.homeBtn} onPress={() => (navigation as any).navigate('TaxiHome')}>
                        <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ─── PENDING ──────────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            <View style={styles.pendingCard}>
                {/* Animation pulsation */}
                <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]}>
                    <View style={styles.pulseInner}>
                        <Text style={styles.taxiEmoji}>🚕</Text>
                    </View>
                </Animated.View>

                <Text style={styles.pendingTitle}>En attente du chauffeur</Text>
                <Text style={styles.pendingSubtitle}>Votre demande a été envoyée. Le chauffeur a {countdown}s pour accepter.</Text>

                {/* Countdown bar */}
                <View style={styles.countdownBar}>
                    <View style={[styles.countdownFill, { width: `${(countdown / 60) * 100}%`, backgroundColor: countdown > 20 ? '#059669' : '#DC2626' }]} />
                </View>
                <Text style={[styles.countdownLabel, { color: countdown > 20 ? '#374151' : '#DC2626' }]}>{countdown}s</Text>

                {/* Trip info */}
                <View style={styles.tripInfoCard}>
                    <View style={styles.tripRow}><View style={styles.dotGreen} /><Text style={styles.tripAddr} numberOfLines={1}>{departure || 'Départ'}</Text></View>
                    <View style={styles.tripLine} />
                    <View style={styles.tripRow}><View style={styles.dotRed} /><Text style={styles.tripAddr} numberOfLines={1}>{destination || 'Arrivée'}</Text></View>
                    {distanceKm && tarifEstime && (
                        <View style={styles.fareRow}>
                            <SafeIcon name="map" size={13} color="#6B7280" />
                            <Text style={styles.fareText}>{distanceKm} km</Text>
                            <SafeIcon name="clock" size={13} color="#6B7280" />
                            <Text style={styles.fareText}>~{dureeMin} min</Text>
                            <SafeIcon name="dollar-sign" size={13} color={modernColors.primary} />
                            <Text style={[styles.fareText, { color: modernColors.primary, fontWeight: '800' }]}>{tarifEstime.toLocaleString()} FCFA</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                    <SafeIcon name="x" size={16} color="#DC2626" />
                    <Text style={styles.cancelBtnText}>Annuler la demande</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', padding: 20 },
    // Pending
    pendingCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
    pulseRing: { width: 110, height: 110, borderRadius: 55, backgroundColor: `${modernColors.primary}20`, justifyContent: 'center', alignItems: 'center' },
    pulseInner: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${modernColors.primary}30`, justifyContent: 'center', alignItems: 'center' },
    taxiEmoji: { fontSize: 40 },
    pendingTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
    pendingSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
    countdownBar: { width: '100%', height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
    countdownFill: { height: '100%', borderRadius: 4 },
    countdownLabel: { fontSize: 28, fontWeight: '900' },
    tripInfoCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, width: '100%', gap: 4 },
    fareRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
    fareText: { fontSize: 13, color: '#6B7280' },
    tripRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tripLine: { width: 2, height: 12, backgroundColor: '#E5E7EB', marginLeft: 5, marginVertical: 2 },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
    tripAddr: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    cancelBtnText: { fontSize: 14, color: '#DC2626', fontWeight: '600' },
    // Accepted
    acceptedCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
    acceptedIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center' },
    acceptedTitle: { fontSize: 24, fontWeight: '900', color: '#059669' },
    acceptedSub: { fontSize: 14, color: '#6B7280' },
    driverCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, width: '100%' },
    driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    driverName: { fontSize: 15, fontWeight: '700', color: '#111827' },
    driverPhone: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    verifiedText: { fontSize: 11, fontWeight: '700', color: '#059669' },
    tripSummary: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, width: '100%', gap: 4 },
    tripMeta: { fontSize: 12, color: '#6B7280', marginTop: 8 },
    trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: modernColors.primary, paddingVertical: 14, borderRadius: 12, width: '100%', justifyContent: 'center' },
    trackBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    payNowBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12, width: '100%', justifyContent: 'center', borderWidth: 1, borderColor: modernColors.primary },
    payNowBtnText: { color: modernColors.primary, fontSize: 14, fontWeight: '700' },
    // Refused
    refusedCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
    refusedTitle: { fontSize: 22, fontWeight: '800', color: '#DC2626' },
    refusedSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: modernColors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
    retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    homeBtn: { paddingVertical: 12 },
    homeBtnText: { fontSize: 14, color: '#9CA3AF' },
});

export default TaxiRequestWaitingScreen;
