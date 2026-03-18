/**
 * Composant GPS Temps Réel pour Transport Intra-Urbain
 * Permet au chauffeur de naviguer vers le client et vice-versa
 */
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import SafeIcon from '../../../components/SafeIcon';

const { width, height } = Dimensions.get('window');

interface RealTimeGPSModalProps {
    visible: boolean;
    onClose: () => void;
    clientLocation: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    driverLocation?: {
        latitude: number;
        longitude: number;
    };
    mode: 'pickup' | 'destination'; // pickup = aller chercher client, destination = aller à destination
    onLocationUpdate?: (location: { latitude: number; longitude: number }) => void;
}

const RealTimeGPSModal: React.FC<RealTimeGPSModalProps> = ({
    visible,
    onClose,
    clientLocation,
    driverLocation,
    mode,
    onLocationUpdate,
}) => {
    const [currentLocation, setCurrentLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [routeCoordinates, setRouteCoordinates] = useState<Array<{
        latitude: number;
        longitude: number;
    }>>([]);
    const [distance, setDistance] = useState<number | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const mapRef = useRef<MapView>(null);

    // Obtenir la position actuelle du chauffeur
    const getCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Permission de localisation nécessaire pour la navigation');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            setCurrentLocation(coords);
            onLocationUpdate?.(coords);

            // Calculer la route si on a les deux positions
            if (mode === 'pickup' && clientLocation) {
                await calculateRoute(coords, clientLocation);
            } else if (mode === 'destination' && clientLocation) {
                await calculateRoute(coords, clientLocation);
            }

        } catch (error) {
            console.error('Erreur GPS:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position');
        }
    };

    // Calculer la route entre deux points
    const calculateRoute = async (
        origin: { latitude: number; longitude: number },
        destination: { latitude: number; longitude: number }
    ) => {
        try {
            // Utiliser l'API Google Maps pour obtenir la route
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=YOUR_GOOGLE_MAPS_API_KEY`
            );

            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const leg = route.legs[0];

                // Extraire les coordonnées de la route
                const coordinates = route.overview_polyline.points
                    .split('')
                    .map((point: string, index: number) => {
                        if (index % 2 === 0) {
                            return {
                                latitude: parseFloat(point) / 1000000,
                                longitude: parseFloat(route.overview_polyline.points[index + 1]) / 1000000,
                            };
                        }
                        return null;
                    })
                    .filter(Boolean);

                setRouteCoordinates(coordinates);
                setDistance(leg.distance.value / 1000); // Convertir en km
                setDuration(leg.duration.value / 60); // Convertir en minutes
            }
        } catch (error) {
            console.error('Erreur calcul route:', error);
        }
    };

    // Ouvrir Google Maps pour navigation
    const openGoogleMaps = () => {
        const destination = `${clientLocation.latitude},${clientLocation.longitude}`;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

        Linking.openURL(url).catch(() => {
            Alert.alert('Erreur', 'Impossible d\'ouvrir Google Maps');
        });
    };

    // Ouvrir Waze
    const openWaze = () => {
        const destination = `${clientLocation.latitude},${clientLocation.longitude}`;
        const url = `waze://?ll=${destination}&navigate=yes`;

        Linking.openURL(url).catch(() => {
            Alert.alert('Erreur', 'Waze n\'est pas installé');
        });
    };

    // Démarrer la navigation
    const startNavigation = () => {
        setIsNavigating(true);
        // Ici on pourrait démarrer le tracking GPS continu
        // et envoyer les mises à jour au client via WebSocket
    };

    useEffect(() => {
        if (visible) {
            getCurrentLocation();
        }
    }, [visible]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>
                            {mode === 'pickup' ? '\uD83D\uDCCD Aller chercher le client' : '\uD83C\uDFAF Aller à destination'}
                        </Text>
                        <Text style={styles.headerSubtitle}>
                            {clientLocation.address || 'Adresse du client'}
                        </Text>
                    </View>
                </View>

                {/* Informations de route */}
                {distance && duration && (
                    <View style={styles.routeInfo}>
                        <View style={styles.routeItem}>
                            <SafeIcon name="map-pin" size={16} color="#F59E0B" />
                            <Text style={styles.routeText}>{distance.toFixed(1)} km</Text>
                        </View>
                        <View style={styles.routeItem}>
                            <SafeIcon name="clock" size={16} color="#F59E0B" />
                            <Text style={styles.routeText}>{Math.round(duration)} min</Text>
                        </View>
                    </View>
                )}

                {/* Carte */}
                <View style={styles.mapContainer}>
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={{
                            latitude: clientLocation.latitude,
                            longitude: clientLocation.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }}
                        showsUserLocation={true}
                        showsMyLocationButton={true}
                    >
                        {/* Marqueur client */}
                        <Marker
                            coordinate={clientLocation}
                            title={mode === 'pickup' ? 'Client à récupérer' : 'Destination'}
                            description={clientLocation.address}
                            pinColor="#10B981"
                        />

                        {/* Marqueur chauffeur */}
                        {currentLocation && (
                            <Marker
                                coordinate={currentLocation}
                                title="Votre position"
                                pinColor="#F59E0B"
                            />
                        )}

                        {/* Route */}
                        {routeCoordinates.length > 0 && (
                            <Polyline
                                coordinates={routeCoordinates}
                                strokeColor="#F59E0B"
                                strokeWidth={4}
                            />
                        )}
                    </MapView>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.navigationButton]}
                        onPress={startNavigation}
                    >
                        <SafeIcon name="navigation" size={20} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>
                            {isNavigating ? 'Navigation en cours...' : 'Démarrer Navigation'}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.externalApps}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.externalButton]}
                            onPress={openGoogleMaps}
                        >
                            <SafeIcon name="map" size={16} color="#F59E0B" />
                            <Text style={styles.externalButtonText}>Google Maps</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.externalButton]}
                            onPress={openWaze}
                        >
                            <SafeIcon name="navigation" size={16} color="#F59E0B" />
                            <Text style={styles.externalButtonText}>Waze</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F59E0B',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
    },
    closeButton: {
        marginRight: 15,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#FEF3C7',
        marginTop: 2,
    },
    routeInfo: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 15,
        backgroundColor: '#FEF3C7',
        gap: 30,
    },
    routeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#92400E',
    },
    mapContainer: {
        flex: 1,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    actions: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        borderRadius: 12,
        marginBottom: 10,
    },
    navigationButton: {
        backgroundColor: '#F59E0B',
        gap: 10,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    externalApps: {
        flexDirection: 'row',
        gap: 10,
    },
    externalButton: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F59E0B',
        gap: 8,
    },
    externalButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#F59E0B',
    },
});

export default RealTimeGPSModal;
