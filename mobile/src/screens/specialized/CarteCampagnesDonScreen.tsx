import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const { height } = Dimensions.get('window');

const CarteCampagnesDonScreen: React.FC = () => {
    const mapRef = useRef<MapView>(null);
    const [campagnes, setCampagnes] = useState<any[]>([]);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            }
            loadCampagnes();
        })();
    }, []);

    const loadCampagnes = async () => {
        try {
            const res = await apiGet('/api/banques-sang/campagnes');
            setCampagnes(res?.data || []);
        } catch {
            setCampagnes([
                { id: 1, titre: 'Collecte CHU', lieu: 'CHU Yaoundé', date_debut: new Date().toISOString(), groupes: ['O+', 'AB-'], latitude: 3.866, longitude: 11.516 },
                { id: 2, titre: 'Don du Sang à CNPS', lieu: 'CNPS Centre', date_debut: new Date(Date.now() + 86400000 * 2).toISOString(), groupes: ['A+', 'B+'], latitude: 3.870, longitude: 11.521 },
            ]);
        } finally { setLoading(false); }
    };

    const handleParticiper = async (campagneId: number) => {
        try {
            await apiPost(`/api/banques-sang/campagnes/${campagneId}/participations`, {});
            Alert.alert('Inscription confirmée', 'Vous recevrez un rappel avant la campagne.');
        } catch { Alert.alert('Erreur', 'Impossible de s\'inscrire.'); }
    };

    const initialRegion = userLocation
        ? { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        : campagnes[0]
            ? { latitude: campagnes[0].latitude, longitude: campagnes[0].longitude, latitudeDelta: 0.1, longitudeDelta: 0.1 }
            : { latitude: 3.866, longitude: 11.516, latitudeDelta: 0.1, longitudeDelta: 0.1 };

    return (
        <View style={styles.container}>
            <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} showsUserLocation>
                {campagnes.map(c => (
                    <Marker key={c.id} coordinate={{ latitude: c.latitude, longitude: c.longitude }}
                        pinColor="#DC2626" onPress={() => setSelected(c)}>
                        <View style={styles.markerPin}><Text style={styles.markerText}>🩸</Text></View>
                        <Callout>
                            <View style={styles.callout}>
                                <Text style={styles.calloutTitle}>{c.titre}</Text>
                                <Text style={styles.calloutMeta}>{c.lieu}</Text>
                                <Text style={styles.calloutDate}>{new Date(c.date_debut).toLocaleDateString('fr-FR')}</Text>
                            </View>
                        </Callout>
                    </Marker>
                ))}
            </MapView>

            <View style={styles.bottomSheet}>
                <View style={styles.bottomHandle} />
                <Text style={styles.sectionTitle}>{loading ? 'Chargement...' : `${campagnes.length} campagne${campagnes.length > 1 ? 's' : ''} à proximité`}</Text>
                <FlatList
                    data={campagnes}
                    keyExtractor={c => c.id.toString()}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={[styles.campagneCard, selected?.id === item.id && styles.campagneCardSelected]}
                            onPress={() => { setSelected(item); mapRef.current?.animateToRegion({ latitude: item.latitude, longitude: item.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800); }}>
                            <View style={styles.campagneLeft}>
                                <Text style={styles.campagneTitle}>{item.titre}</Text>
                                <Text style={styles.campagneLieu}>{item.lieu}</Text>
                                <Text style={styles.campagneDate}>{new Date(item.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</Text>
                                <View style={styles.groupesRow}>
                                    {(item.groupes || []).map((g: string) => (
                                        <View key={g} style={styles.groupeBadge}><Text style={styles.groupeText}>{g}</Text></View>
                                    ))}
                                </View>
                            </View>
                            <TouchableOpacity style={styles.participerBtn} onPress={() => handleParticiper(item.id)}>
                                <Text style={styles.participerText}>Je participe</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    )}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { height: height * 0.55 },
    markerPin: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 },
    markerText: { fontSize: 20 },
    callout: { padding: 8, minWidth: 150 },
    calloutTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
    calloutMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    calloutDate: { fontSize: 11, color: modernColors.primary, marginTop: 2 },
    bottomSheet: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
    bottomHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    campagneCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#F9FAFB', marginBottom: 10, borderWidth: 1, borderColor: 'transparent' },
    campagneCardSelected: { borderColor: modernColors.primary, backgroundColor: '#EFF6FF' },
    campagneLeft: { flex: 1 },
    campagneTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
    campagneLieu: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    campagneDate: { fontSize: 12, color: modernColors.primary, marginTop: 2 },
    groupesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
    groupeBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    groupeText: { fontSize: 11, color: '#DC2626', fontWeight: '600' },
    participerBtn: { backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, marginLeft: 10 },
    participerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

export default CarteCampagnesDonScreen;
