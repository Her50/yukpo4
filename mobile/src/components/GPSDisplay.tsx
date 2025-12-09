import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface GPSDisplayProps {
    location?: { lat: number; lng: number };
    onLocationPress?: () => void;
    showDetails?: boolean;
}

const GPSDisplay: React.FC<GPSDisplayProps> = ({
    location,
    onLocationPress,
    showDetails = false
}) => {
    const [address, setAddress] = useState<string>('');

    // Fonction pour obtenir l'adresse à partir des coordonnées (géocodage inverse)
    const getAddressFromCoords = async (lat: number, lng: number) => {
        try {
            // Simulation d'un géocodage inverse
            // En production, vous utiliseriez une vraie API comme Google Geocoding
            await new Promise(resolve => setTimeout(resolve, 500));

            // Données mockées basées sur la position
            const mockAddresses = [
                'Yaoundé, Cameroun',
                'Douala, Cameroun',
                'Garoua, Cameroun',
                'Bamenda, Cameroun',
                'Bafoussam, Cameroun'
            ];

            return mockAddresses[Math.floor(Math.random() * mockAddresses.length)];
        } catch (error) {
            console.error('Erreur géocodage:', error);
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    };

    // Charger l'adresse quand la position change
    useEffect(() => {
        if (location) {
            getAddressFromCoords(location.lat, location.lng).then(setAddress);
        }
    }, [location]);

    const handlePress = () => {
        if (onLocationPress) {
            onLocationPress();
        } else if (location) {
            Alert.alert(
                'Position GPS',
                `Latitude: ${location.lat.toFixed(6)}\nLongitude: ${location.lng.toFixed(6)}\n\nAdresse: ${address}`,
                [{ text: 'OK' }]
            );
        }
    };

    if (!location) {
        return (
            <View style={styles.container}>
                <TouchableOpacity style={styles.noLocationContainer} onPress={handlePress}>
                    <Text style={styles.noLocationIcon}>📍</Text>
                    <View style={styles.noLocationInfo}>
                        <Text style={styles.noLocationText}>GPS non activé</Text>
                        <Text style={styles.noLocationSubtext}>Appuyez pour activer</Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.gpsCard} onPress={handlePress}>
                <View style={styles.gpsHeader}>
                    <Text style={styles.gpsIcon}>📍</Text>
                    <View style={styles.gpsInfo}>
                        <Text style={styles.gpsStatus}>GPS Activé</Text>
                        <Text style={styles.gpsAddress} numberOfLines={1}>
                            {address || 'Chargement...'}
                        </Text>
                    </View>
                </View>

                {showDetails && (
                    <View style={styles.gpsDetails}>
                        <View style={styles.coordItem}>
                            <Text style={styles.coordLabel}>Lat:</Text>
                            <Text style={styles.coordValue}>
                                {location.lat != null && Number.isFinite(location.lat) ? location.lat.toFixed(6) : '0.000000'}
                            </Text>
                        </View>
                        <View style={styles.coordItem}>
                            <Text style={styles.coordLabel}>Lng:</Text>
                            <Text style={styles.coordValue}>
                                {location.lng != null && Number.isFinite(location.lng) ? location.lng.toFixed(6) : '0.000000'}
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.gpsFooter}>
                    <Text style={styles.gpsHint}>Appuyez pour modifier</Text>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    noLocationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    noLocationIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    noLocationInfo: {
        flex: 1,
    },
    noLocationText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '500',
        marginBottom: 2,
    },
    noLocationSubtext: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    gpsCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    gpsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    gpsIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    gpsInfo: {
        flex: 1,
    },
    gpsStatus: {
        fontSize: 14,
        color: '#4CAF50',
        fontWeight: '600',
        marginBottom: 2,
    },
    gpsAddress: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '500',
    },
    gpsDetails: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
    },
    coordItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    coordLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        marginRight: 4,
        fontWeight: '500',
    },
    coordValue: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: 'monospace',
        fontWeight: '500',
    },
    gpsFooter: {
        alignItems: 'center',
    },
    gpsHint: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        fontStyle: 'italic',
    },
});

export default GPSDisplay;



