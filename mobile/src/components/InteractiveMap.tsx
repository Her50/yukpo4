import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';

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
    const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(
        initialLocation ? { latitude: initialLocation.latitude, longitude: initialLocation.longitude } : null
    );
    const [radius, setRadius] = useState(initialRadius);
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
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
            setSelectedLocation(newLocation);
        } catch (error) {
            console.error('Erreur GPS:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
        } finally {
            setLoading(false);
        }
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

    // Obtenir la position actuelle au chargement
    useEffect(() => {
        getCurrentLocation();
    }, []);

    return (
        <View style={styles.container}>
            {/* Affichage simplifié de la position */}
            <View style={styles.locationDisplay}>
                <Text style={styles.title}>📍 Sélection de la position</Text>
                
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FF8C00" />
                        <Text style={styles.loadingText}>Obtention de votre position...</Text>
                    </View>
                )}

                {selectedLocation && !loading && (
                    <View style={styles.locationInfo}>
                        <Text style={styles.locationLabel}>Position sélectionnée :</Text>
                        <Text style={styles.locationCoords}>
                            Latitude: {selectedLocation.latitude.toFixed(6)}
                        </Text>
                        <Text style={styles.locationCoords}>
                            Longitude: {selectedLocation.longitude.toFixed(6)}
                        </Text>
                        {showRadiusSelector && (
                            <Text style={styles.radiusInfo}>Rayon: {radius} km</Text>
                        )}
                    </View>
                )}

                {!selectedLocation && !loading && (
                    <Text style={styles.helpText}>
                        Appuyez sur le bouton ci-dessous pour obtenir votre position actuelle
                    </Text>
                )}
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
                    <TouchableOpacity
                        style={styles.useCurrentButton}
                        onPress={getCurrentLocation}
                        disabled={loading}
                    >
                        <Text style={styles.useCurrentButtonText}>
                            {loading ? '⏳ Chargement...' : '📍 Actualiser position'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.confirmButton, !selectedLocation && styles.confirmButtonDisabled]}
                        onPress={handleConfirmSelection}
                        disabled={!selectedLocation}
                    >
                        <Text style={styles.confirmButtonText}>✓ Confirmer</Text>
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeButtonText}>Annuler</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    locationDisplay: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
        color: '#333',
    },
    loadingContainer: {
        alignItems: 'center',
        gap: 15,
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
    },
    locationInfo: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 12,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    locationLabel: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    locationCoords: {
        fontSize: 16,
        color: '#666',
        marginVertical: 4,
    },
    radiusInfo: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF8C00',
        marginTop: 10,
    },
    helpText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    closeButton: {
        backgroundColor: '#f0f0f0',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    closeButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
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
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        backgroundColor: '#ccc',
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default InteractiveMap;




