import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, LatLng, Marker, Region } from 'react-native-maps';

interface InteractiveMapProps {
    initialLocation?: { latitude: number; longitude: number };
    onLocationSelect: (location: { latitude: number; longitude: number; radius: number }) => void;
    onClose: () => void;
    showRadiusSelector?: boolean;
    initialRadius?: number;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({
    initialLocation,
    onLocationSelect,
    onClose,
    showRadiusSelector = true,
    initialRadius = 50
}) => {
    const mapRef = useRef<MapView>(null);
    const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(
        initialLocation ? { latitude: initialLocation.latitude, longitude: initialLocation.longitude } : null
    );
    const [radius, setRadius] = useState(initialRadius);
    const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
    const [loading, setLoading] = useState(false);

    // Obtenir la position actuelle
    const getCurrentLocation = async () => {
        try {
            setLoading(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission refusée', 'Permission de localisation refusée');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const newLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            setCurrentLocation(newLocation);

            // Centrer la carte sur la position actuelle
            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude: newLocation.latitude,
                    longitude: newLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });
            }
        } catch (error) {
            console.error('Erreur GPS:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
        } finally {
            setLoading(false);
        }
    };

    // Gérer le tap sur la carte
    const handleMapPress = (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        setSelectedLocation({ latitude, longitude });
    };

    // Confirmer la sélection
    const handleConfirmSelection = () => {
        if (selectedLocation) {
            onLocationSelect({
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                radius: radius
            });
            onClose();
        } else {
            Alert.alert('Erreur', 'Veuillez sélectionner un emplacement sur la carte');
        }
    };

    // Utiliser la position actuelle
    const handleUseCurrentLocation = () => {
        if (currentLocation) {
            setSelectedLocation(currentLocation);
            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });
            }
        }
    };

    // Région initiale de la carte
    const getInitialRegion = (): Region => {
        if (selectedLocation) {
            return {
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
        }

        if (currentLocation) {
            return {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
        }

        // Position par défaut (Yaoundé, Cameroun)
        return {
            latitude: 3.8480,
            longitude: 11.5021,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
        };
    };

    // Obtenir la position actuelle au chargement
    useEffect(() => {
        getCurrentLocation();
    }, []);

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={getInitialRegion()}
                onPress={handleMapPress}
                showsUserLocation={true}
                showsMyLocationButton={false}
                showsCompass={true}
                showsScale={true}
                mapType="standard"
            >
                {/* Marqueur de position sélectionnée */}
                {selectedLocation && (
                    <Marker
                        coordinate={selectedLocation}
                        title="Position sélectionnée"
                        description="Appuyez pour confirmer"
                        pinColor="red"
                    />
                )}

                {/* Cercle de rayon si sélectionné */}
                {selectedLocation && showRadiusSelector && (
                    <Circle
                        center={selectedLocation}
                        radius={radius * 1000} // Convertir km en mètres
                        strokeColor="rgba(255, 0, 0, 0.5)"
                        fillColor="rgba(255, 0, 0, 0.1)"
                        strokeWidth={2}
                    />
                )}
            </MapView>

            {/* Contrôles en haut */}
            <View style={styles.topControls}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.currentLocationButton}
                    onPress={getCurrentLocation}
                    disabled={loading}
                >
                    <Text style={styles.currentLocationButtonText}>
                        {loading ? '⏳' : '📍'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Contrôles en bas */}
            <View style={styles.bottomControls}>
                {showRadiusSelector && (
                    <View style={styles.radiusControl}>
                        <Text style={styles.radiusLabel}>Rayon: {radius} km</Text>
                        <View style={styles.radiusButtons}>
                            {[1, 5, 10, 25, 50, 100].map((value) => (
                                <TouchableOpacity
                                    key={value}
                                    style={[
                                        styles.radiusButton,
                                        radius === value && styles.radiusButtonActive
                                    ]}
                                    onPress={() => setRadius(value)}
                                >
                                    <Text style={[
                                        styles.radiusButtonText,
                                        radius === value && styles.radiusButtonTextActive
                                    ]}>
                                        {value}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.actionButtons}>
                    {currentLocation && (
                        <TouchableOpacity
                            style={styles.useCurrentButton}
                            onPress={handleUseCurrentLocation}
                        >
                            <Text style={styles.useCurrentButtonText}>📍 Ma position</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={handleConfirmSelection}
                        disabled={!selectedLocation}
                    >
                        <Text style={styles.confirmButtonText}>✓ Confirmer</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    topControls: {
        position: 'absolute',
        top: 50,
        right: 20,
        flexDirection: 'row',
        gap: 10,
    },
    closeButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    currentLocationButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    currentLocationButtonText: {
        color: 'white',
        fontSize: 18,
    },
    bottomControls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    radiusControl: {
        marginBottom: 15,
    },
    radiusLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        textAlign: 'center',
    },
    radiusButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: 8,
    },
    radiusButton: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 15,
        minWidth: 40,
        alignItems: 'center',
    },
    radiusButtonActive: {
        backgroundColor: '#FF8C00',
    },
    radiusButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#333',
    },
    radiusButtonTextActive: {
        color: 'white',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    useCurrentButton: {
        flex: 1,
        backgroundColor: '#4CAF50',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    useCurrentButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: '#FF8C00',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default InteractiveMap;

