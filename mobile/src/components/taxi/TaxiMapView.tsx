// Carte interactive pour la recherche GPS de taxis
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';

const { width, height } = Dimensions.get('window');

interface TaxiItem {
    id: number;
    service_id?: number;
    zone: string;
    gps_actuel?: string;
    is_available_now: boolean;
    tarif_base?: number;
    devise?: string;
    nom_chauffeur?: string;
    type_vehicule?: string;
}

interface TaxiMapViewProps {
    taxis: TaxiItem[];
    currentLocation?: { latitude: number; longitude: number };
    radiusKm?: number;
    onTaxiPress?: (taxi: TaxiItem) => void;
}

const parseGps = (gps?: string): { latitude: number; longitude: number } | null => {
    if (!gps) return null;
    const parts = gps.split(',').map(parseFloat);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { latitude: parts[0], longitude: parts[1] };
    }
    return null;
};

const TaxiMapView: React.FC<TaxiMapViewProps> = ({
    taxis,
    currentLocation,
    radiusKm = 50,
    onTaxiPress,
}) => {
    const mapRef = useRef<MapView>(null);
    const [selectedTaxi, setSelectedTaxi] = useState<TaxiItem | null>(null);
    const [mapRegion] = useState({
        latitude: currentLocation?.latitude || 4.0511, // Douala par défaut
        longitude: currentLocation?.longitude || 9.7679,
        latitudeDelta: radiusKm / 55,
        longitudeDelta: radiusKm / 55,
    });

    useEffect(() => {
        if (currentLocation && mapRef.current) {
            mapRef.current.animateToRegion({
                ...currentLocation,
                latitudeDelta: radiusKm / 55,
                longitudeDelta: radiusKm / 55,
            }, 800);
        }
    }, [currentLocation, radiusKm]);

    const taxisWithGps = taxis
        .map((taxi) => ({ taxi, coords: parseGps(taxi.gps_actuel) }))
        .filter((t) => t.coords !== null) as { taxi: TaxiItem; coords: { latitude: number; longitude: number } }[];

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={mapRegion}
                showsUserLocation={!!currentLocation}
                showsMyLocationButton={true}
            >
                {/* Cercle de rayon */}
                {currentLocation && (
                    <Circle
                        center={currentLocation}
                        radius={radiusKm * 1000}
                        strokeColor="rgba(6,182,212,0.4)"
                        fillColor="rgba(6,182,212,0.08)"
                        strokeWidth={2}
                    />
                )}

                {/* Marqueurs taxi */}
                {taxisWithGps.map(({ taxi, coords }) => (
                    <Marker
                        key={taxi.id}
                        coordinate={coords}
                        onPress={() => {
                            setSelectedTaxi(taxi);
                            onTaxiPress?.(taxi);
                        }}
                    >
                        <View style={[
                            styles.taxiMarker,
                            { backgroundColor: taxi.is_available_now ? '#06B6D4' : '#9CA3AF' },
                        ]}>
                            <SafeIcon name="car" size={18} color="#fff" />
                        </View>
                    </Marker>
                ))}
            </MapView>

            {/* Légende */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#06B6D4' }]} />
                    <Text style={styles.legendText}>Disponible</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#9CA3AF' }]} />
                    <Text style={styles.legendText}>Occupé</Text>
                </View>
                <Text style={styles.legendCount}>{taxis.length} taxi{taxis.length > 1 ? 's' : ''}</Text>
            </View>

            {/* Popup taxi sélectionné */}
            {selectedTaxi && (
                <View style={styles.popup}>
                    <View style={styles.popupLeft}>
                        <Text style={styles.popupZone}>{selectedTaxi.zone}</Text>
                        {selectedTaxi.nom_chauffeur && (
                            <Text style={styles.popupDriver}>{selectedTaxi.nom_chauffeur}</Text>
                        )}
                        {selectedTaxi.tarif_base != null && (
                            <Text style={styles.popupPrice}>
                                {selectedTaxi.tarif_base.toLocaleString()} {selectedTaxi.devise || 'XAF'}
                            </Text>
                        )}
                    </View>
                    <View style={styles.popupRight}>
                        <TouchableOpacity
                            style={styles.popupBtn}
                            onPress={() => onTaxiPress?.(selectedTaxi)}
                        >
                            <Text style={styles.popupBtnText}>Voir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.popupClose}
                            onPress={() => setSelectedTaxi(null)}
                        >
                            <SafeIcon name="x" size={16} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, position: 'relative' },
    map: { width: '100%', height: '100%' },
    taxiMarker: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    legend: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 10,
        padding: 10,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, color: '#374151' },
    legendCount: { fontSize: 11, color: modernColors.textSecondary, textAlign: 'right', marginTop: 2 },
    popup: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    popupLeft: { flex: 1 },
    popupZone: { fontSize: 15, fontWeight: '700', color: '#111827' },
    popupDriver: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    popupPrice: { fontSize: 13, fontWeight: '600', color: '#D97706', marginTop: 2 },
    popupRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    popupBtn: {
        backgroundColor: '#06B6D4',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    popupBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    popupClose: { padding: 4 },
});

export default TaxiMapView;
