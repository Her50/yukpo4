import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

interface BusPosition {
    latitude: number;
    longitude: number;
    vitesse_km_h: number;
    cap_degres: number;
    updated_at: string;
}

interface StopInfo {
    id: number;
    nom: string;
    latitude: number;
    longitude: number;
    eta_minutes?: number;
    statut: 'passed' | 'current' | 'upcoming';
}

const BusTrackingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { ticketId, busId, trajet, departStop, arrivalStop } = route.params || {};
    const mapRef = useRef<MapView>(null);

    const [busPos, setBusPos] = useState<BusPosition | null>(null);
    const [stops, setStops] = useState<StopInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        loadTracking();
        pollRef.current = setInterval(loadTracking, 15000); // refresh every 15s
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const loadTracking = async () => {
        try {
            const res = await apiGet(`/api/bus-tickets/tracking/${busId || ticketId}`);
            if (res?.data?.position) {
                const pos = res.data.position;
                setBusPos(pos);
                setStops(res.data.stops || []);
                setEtaMinutes(res.data.eta_minutes);
                mapRef.current?.animateToRegion({
                    latitude: pos.latitude, longitude: pos.longitude,
                    latitudeDelta: 0.05, longitudeDelta: 0.05,
                }, 500);
            }
        } catch {
            // Demo data
            const demoPos = { latitude: 3.866 + Math.random() * 0.01, longitude: 11.517 + Math.random() * 0.01, vitesse_km_h: 45, cap_degres: 180, updated_at: new Date().toISOString() };
            setBusPos(demoPos);
            setEtaMinutes(Math.floor(12 + Math.random() * 5));
            setStops([
                { id: 1, nom: 'Gare Centrale', latitude: 3.870, longitude: 11.510, statut: 'passed' },
                { id: 2, nom: 'Carrefour Nlongkak', latitude: 3.860, longitude: 11.510, statut: 'passed' },
                { id: 3, nom: 'Essos Marché', latitude: 3.850, longitude: 11.515, eta_minutes: 8, statut: 'current' },
                { id: 4, nom: departStop || 'Votre arrêt', latitude: 3.840, longitude: 11.520, eta_minutes: 14, statut: 'upcoming' },
                { id: 5, nom: arrivalStop || 'Destination', latitude: 3.820, longitude: 11.530, eta_minutes: 35, statut: 'upcoming' },
            ]);
        } finally { setLoading(false); }
    };

    const myStop = stops.find(s => s.nom === (departStop || arrivalStop) || s.statut === 'upcoming');
    const nextStop = stops.find(s => s.statut === 'current');

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>;

    return (
        <View style={styles.container}>
            {/* Map */}
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={busPos ? { latitude: busPos.latitude, longitude: busPos.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 } : { latitude: 3.848, longitude: 11.502, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
                showsUserLocation
            >
                {/* Bus marker */}
                {busPos && (
                    <Marker coordinate={{ latitude: busPos.latitude, longitude: busPos.longitude }} title="Votre bus">
                        <View style={styles.busMarker}>
                            <Text style={styles.busMarkerEmoji}>🚌</Text>
                        </View>
                    </Marker>
                )}

                {/* Stop markers */}
                {stops.map(stop => (
                    <Marker key={stop.id} coordinate={{ latitude: stop.latitude, longitude: stop.longitude }} title={stop.nom}>
                        <View style={[styles.stopMarker, stop.statut === 'passed' && styles.stopPassed, stop.statut === 'current' && styles.stopCurrent]}>
                            <View style={styles.stopDot} />
                        </View>
                    </Marker>
                ))}

                {/* Route line */}
                {stops.length > 1 && (
                    <Polyline coordinates={stops.map(s => ({ latitude: s.latitude, longitude: s.longitude }))} strokeColor={modernColors.primary} strokeWidth={3} />
                )}
            </MapView>

            {/* ETA Card */}
            <View style={styles.etaCard}>
                <View style={styles.etaMain}>
                    <SafeIcon name="clock" size={22} color={modernColors.primary} />
                    <View>
                        <Text style={styles.etaLabel}>Arrivée estimée</Text>
                        <Text style={styles.etaValue}>
                            {myStop?.eta_minutes ? `${myStop.eta_minutes} min` : etaMinutes ? `${etaMinutes} min` : 'Calcul...'}
                        </Text>
                    </View>
                </View>
                {busPos && (
                    <View style={styles.speedBadge}>
                        <SafeIcon name="zap" size={14} color="#6B7280" />
                        <Text style={styles.speedText}>{Math.round(busPos.vitesse_km_h)} km/h</Text>
                    </View>
                )}
            </View>

            {/* Stops list */}
            <View style={styles.stopsPanel}>
                <View style={styles.stopsPanelHeader}>
                    <Text style={styles.stopsPanelTitle}>{trajet || 'Trajet en cours'}</Text>
                    <TouchableOpacity onPress={() => { if (pollRef.current) clearInterval(pollRef.current); navigation.goBack(); }}>
                        <SafeIcon name="x" size={22} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                {stops.map((stop, idx) => (
                    <View key={stop.id} style={styles.stopRow}>
                        <View style={styles.stopIconCol}>
                            <View style={[styles.stopCircle,
                                stop.statut === 'passed' && styles.stopCirclePassed,
                                stop.statut === 'current' && styles.stopCircleCurrent,
                            ]}>
                                {stop.statut === 'passed' && <SafeIcon name="check" size={12} color="#fff" />}
                                {stop.statut === 'current' && <View style={styles.stopCurrentPulse} />}
                            </View>
                            {idx < stops.length - 1 && <View style={[styles.stopConnector, stop.statut === 'passed' && styles.stopConnectorPassed]} />}
                        </View>
                        <View style={styles.stopInfo}>
                            <Text style={[styles.stopName, stop.statut === 'passed' && styles.stopNamePassed, stop.statut === 'current' && styles.stopNameCurrent]}>
                                {stop.nom}
                                {stop.nom === departStop && ' 📍 Vous'}
                            </Text>
                            {stop.eta_minutes && stop.statut !== 'passed' && (
                                <Text style={styles.stopEta}>Dans {stop.eta_minutes} min</Text>
                            )}
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    map: { flex: 1, minHeight: 300 },
    busMarker: { backgroundColor: '#fff', borderRadius: 20, padding: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
    busMarkerEmoji: { fontSize: 24 },
    stopMarker: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#6B7280', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    stopPassed: { borderColor: '#9CA3AF', backgroundColor: '#9CA3AF' },
    stopCurrent: { borderColor: modernColors.primary, backgroundColor: modernColors.primary, width: 18, height: 18, borderRadius: 9 },
    stopDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
    etaCard: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
    etaMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    etaLabel: { fontSize: 12, color: '#6B7280' },
    etaValue: { fontSize: 22, fontWeight: '800', color: modernColors.primary },
    speedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    speedText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
    stopsPanel: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, maxHeight: 280 },
    stopsPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    stopsPanelTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
    stopRow: { flexDirection: 'row', gap: 12, minHeight: 44 },
    stopIconCol: { width: 20, alignItems: 'center' },
    stopCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    stopCirclePassed: { backgroundColor: '#9CA3AF', borderColor: '#9CA3AF' },
    stopCircleCurrent: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    stopCurrentPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    stopConnector: { flex: 1, width: 2, backgroundColor: '#E5E7EB', marginVertical: 2 },
    stopConnectorPassed: { backgroundColor: '#9CA3AF' },
    stopInfo: { flex: 1, paddingBottom: 12 },
    stopName: { fontSize: 14, fontWeight: '600', color: '#111827' },
    stopNamePassed: { color: '#9CA3AF', fontWeight: '400' },
    stopNameCurrent: { color: modernColors.primary },
    stopEta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});

export default BusTrackingScreen;
