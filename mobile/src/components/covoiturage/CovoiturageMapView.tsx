// ✅ Phase 1.2: Carte interactive pour recherche GPS et visualisation trajets
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

const { width, height } = Dimensions.get('window');

interface CovoiturageTrip {
    id: number;
    depart: string;
    destination: string;
    gps_depart?: string;
    gps_destination?: string;
    prix_par_place: number;
    places_disponibles: number;
    date_depart: string;
    heure_depart?: string;
}

interface CovoiturageMapViewProps {
    trips: CovoiturageTrip[];
    currentLocation?: { latitude: number; longitude: number };
    onTripPress?: (trip: CovoiturageTrip) => void;
    showNearbyOnly?: boolean;
    radiusKm?: number;
}

const CovoiturageMapView: React.FC<CovoiturageMapViewProps> = ({
    trips,
    currentLocation,
    onTripPress,
    showNearbyOnly = false,
    radiusKm = 50
}) => {
    const mapRef = useRef<MapView>(null);
    const [selectedTrip, setSelectedTrip] = useState<CovoiturageTrip | null>(null);
    const [mapRegion, setMapRegion] = useState({
        latitude: currentLocation?.latitude || 4.0511, // Douala par défaut
        longitude: currentLocation?.longitude || 9.7679,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
    });

    useEffect(() => {
        if (currentLocation) {
            setMapRegion({
                ...currentLocation,
                latitudeDelta: 0.5,
                longitudeDelta: 0.5,
            });
            mapRef.current?.animateToRegion({
                ...currentLocation,
                latitudeDelta: 0.5,
                longitudeDelta: 0.5,
            }, 1000);
        }
    }, [currentLocation]);

    const parseGPS = (gpsString?: string): { latitude: number; longitude: number } | null => {
        if (!gpsString) return null;
        const parts = gpsString.split(',');
        if (parts.length !== 2) return null;
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());
        if (isNaN(lat) || isNaN(lng)) return null;
        return { latitude: lat, longitude: lng };
    };

    const calculateDistance = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number => {
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

    const filteredTrips = showNearbyOnly && currentLocation
        ? trips.filter(trip => {
            const departGPS = parseGPS(trip.gps_depart);
            if (!departGPS) return false;
            const distance = calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                departGPS.latitude,
                departGPS.longitude
            );
            return distance <= radiusKm;
        })
        : trips;

    const handleMarkerPress = (trip: CovoiturageTrip) => {
        setSelectedTrip(trip);
        if (onTripPress) {
            onTripPress(trip);
        }
    };

    const renderTripMarkers = () => {
        return filteredTrips.map(trip => {
            const departGPS = parseGPS(trip.gps_depart);
            const destGPS = parseGPS(trip.gps_destination);

            if (!departGPS) return null;

            return (
                <React.Fragment key={trip.id}>
                    {/* Marqueur départ */}
                    <Marker
                        coordinate={departGPS}
                        onPress={() => handleMarkerPress(trip)}
                    >
                        <View style={styles.markerContainer}>
                            <View style={styles.markerDot} />
                            <Text style={styles.markerLabel}>Départ</Text>
                        </View>
                    </Marker>

                    {/* Marqueur destination */}
                    {destGPS && (
                        <Marker
                            coordinate={destGPS}
                            onPress={() => handleMarkerPress(trip)}
                        >
                            <View style={[styles.markerContainer, styles.markerDestination]}>
                                <View style={[styles.markerDot, styles.markerDotDestination]} />
                                <Text style={styles.markerLabel}>Arrivée</Text>
                            </View>
                        </Marker>
                    )}

                    {/* Ligne trajet */}
                    {destGPS && (
                        <Polyline
                            coordinates={[departGPS, destGPS]}
                            strokeColor={modernColors.primary}
                            strokeWidth={3}
                            lineDashPattern={[5, 5]}
                        />
                    )}
                </React.Fragment>
            );
        });
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={mapRegion}
                showsUserLocation={!!currentLocation}
                showsMyLocationButton={true}
                showsCompass={true}
                toolbarEnabled={false}
            >
                {/* Marqueur position actuelle */}
                {currentLocation && (
                    <Marker
                        coordinate={currentLocation}
                        title="Ma position"
                    >
                        <View style={styles.currentLocationMarker}>
                            <View style={styles.currentLocationDot} />
                        </View>
                    </Marker>
                )}

                {/* Marqueurs trajets */}
                {renderTripMarkers()}
            </MapView>

            {/* Info trajet sélectionné */}
            {selectedTrip && (
                <View style={styles.tripInfo}>
                    <View style={styles.tripInfoHeader}>
                        <Text style={styles.tripInfoTitle}>
                            {selectedTrip.depart} → {selectedTrip.destination}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setSelectedTrip(null)}
                            style={styles.closeButton}
                        >
                            <SafeIcon name="x" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.tripInfoDetails}>
                        <View style={styles.tripInfoRow}>
                            <SafeIcon name="calendar" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.tripInfoText}>
                                {new Date(selectedTrip.date_depart).toLocaleDateString('fr-FR')}
                            </Text>
                        </View>
                        {selectedTrip.heure_depart && (
                            <View style={styles.tripInfoRow}>
                                <SafeIcon name="clock" size={14} color={modernColors.textSecondary} />
                                <Text style={styles.tripInfoText}>
                                    {selectedTrip.heure_depart.substring(0, 5)}
                                </Text>
                            </View>
                        )}
                        <View style={styles.tripInfoRow}>
                            <SafeIcon name="users" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.tripInfoText}>
                                {selectedTrip.places_disponibles} places
                            </Text>
                        </View>
                        <View style={styles.tripInfoRow}>
                            <SafeIcon name="dollar-sign" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.tripInfoText}>
                                {selectedTrip.prix_par_place.toLocaleString('fr-FR')} / place
                            </Text>
                        </View>
                    </View>
                    {onTripPress && (
                        <TouchableOpacity
                            style={styles.viewDetailsButton}
                            onPress={() => {
                                onTripPress(selectedTrip);
                                setSelectedTrip(null);
                            }}
                        >
                            <Text style={styles.viewDetailsText}>Voir détails</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Légende */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.legendDotDepart]} />
                    <Text style={styles.legendText}>Départ</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.legendDotDestination]} />
                    <Text style={styles.legendText}>Arrivée</Text>
                </View>
                {currentLocation && (
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, styles.legendDotCurrent]} />
                        <Text style={styles.legendText}>Ma position</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    markerContainer: {
        alignItems: 'center',
    },
    markerDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: modernColors.primary,
        borderWidth: 3,
        borderColor: '#fff',
    },
    markerDestination: {
        // Style pour destination
    },
    markerDotDestination: {
        backgroundColor: '#DC2626',
    },
    markerLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#111827',
        marginTop: 4,
        backgroundColor: '#fff',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
    },
    currentLocationMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    currentLocationDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#10B981',
        borderWidth: 3,
        borderColor: '#fff',
    },
    tripInfo: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    tripInfoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    tripInfoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    tripInfoDetails: {
        gap: 8,
    },
    tripInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tripInfoText: {
        fontSize: 14,
        color: '#374151',
    },
    viewDetailsButton: {
        marginTop: 12,
        padding: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        alignItems: 'center',
    },
    viewDetailsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    legend: {
        position: 'absolute',
        top: 20,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendDotDepart: {
        backgroundColor: modernColors.primary,
    },
    legendDotDestination: {
        backgroundColor: '#DC2626',
    },
    legendDotCurrent: {
        backgroundColor: '#10B981',
    },
    legendText: {
        fontSize: 12,
        color: '#374151',
    },
});

export default CovoiturageMapView;


