// Remplacement des Ionicons par des emojis pour éviter les crashes
import * as Location from 'expo-location';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Card, Paragraph, Title } from 'react-native-paper';
import { theme } from '../theme/theme';
import InteractiveMap from './InteractiveMap';

interface GPSSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (coordinates: { lat: number; lng: number; radius?: number; zoneType?: 'point' | 'circle' | 'rectangle' }) => void;
    currentLocation?: { lat: number; lng: number } | null;
}

const GPSSelector: React.FC<GPSSelectorProps> = ({
    visible,
    onClose,
    onSelect,
    currentLocation
}) => {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [loading, setLoading] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [showMap, setShowMap] = useState(false);

    useEffect(() => {
        if (visible) {
            requestLocationPermission();
        }
    }, [visible]);

    const requestLocationPermission = async () => {
        try {
            // ✅ CORRECTION: Timeout pour éviter les blocages
            const permissionPromise = Location.requestForegroundPermissionsAsync();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Permission timeout')), 10000)
            );

            const { status } = await Promise.race([permissionPromise, timeoutPromise]) as any;

            if (status !== 'granted') {
                Alert.alert(
                    'Permission requise',
                    'L\'accès à la localisation est nécessaire pour utiliser cette fonctionnalité.',
                    [{ text: 'OK' }]
                );
                return;
            }
            setPermissionGranted(true);
            getCurrentLocation();
        } catch (error) {
            console.error('Erreur permission GPS:', error);
            // ✅ CORRECTION: Ne pas afficher d'alerte si timeout
            if (error.message !== 'Permission timeout') {
                Alert.alert('Erreur', 'Impossible d\'accéder à la localisation');
            }
        }
    };

    const getCurrentLocation = async () => {
        try {
            setLoading(true);

            // ✅ CORRECTION: Timeout pour éviter les blocages GPS
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced, // Moins précis mais plus rapide
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('GPS timeout')), 15000)
            );

            const location = await Promise.race([locationPromise, timeoutPromise]) as any;
            setLocation(location);
        } catch (error) {
            console.error('Erreur GPS:', error);
            // ✅ CORRECTION: Gestion d'erreur plus douce
            if (error.message === 'GPS timeout') {
                Alert.alert('GPS lent', 'La localisation prend du temps. Réessayez ou utilisez la recherche d\'adresse.');
            } else {
                Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSelectCurrentLocation = () => {
        if (location) {
            onSelect({
                lat: location.coords.latitude,
                lng: location.coords.longitude
            });
            onClose();
        }
    };

    const handleSelectManualLocation = () => {
        // Pour l'instant, on utilise la position actuelle
        // Dans une version future, on pourrait ajouter une carte interactive
        if (location) {
            onSelect({
                lat: location.coords.latitude,
                lng: location.coords.longitude
            });
            onClose();
        }
    };

    const formatCoordinates = (lat: number | null | undefined, lng: number | null | undefined) => {
        // ✅ SÉCURITÉ: Vérifier que lat et lng sont des nombres valides
        if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return '0.000000, 0.000000';
        }
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeIcon}>❌</Text>
                    </TouchableOpacity>
                    <Title style={styles.title}>Sélectionner une position</Title>
                </View>

                <View style={styles.content}>
                    <Card style={styles.card}>
                        <View style={styles.cardContent}>
                            <View style={styles.iconContainer}>
                                <Text style={styles.locationIcon}>🗺️</Text>
                            </View>

                            <Title style={styles.cardTitle}>Position GPS</Title>
                            <Paragraph style={styles.cardDescription}>
                                Choisissez votre position pour une recherche plus précise
                            </Paragraph>

                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>Récupération de votre position...</Text>
                                </View>
                            ) : location ? (
                                <View style={styles.locationInfo}>
                                    <View style={styles.coordinatesContainer}>
                                        <Text style={styles.mapIcon}>🗺️</Text>
                                        <Text style={styles.coordinatesText}>
                                            {formatCoordinates(location.coords.latitude, location.coords.longitude)}
                                        </Text>
                                    </View>

                                    <View style={styles.accuracyContainer}>
                                        <Text style={styles.checkIcon}>✅</Text>
                                        <Text style={styles.accuracyText}>
                                            Précision: {location.coords.accuracy != null && Number.isFinite(location.coords.accuracy) ? String(Math.round(location.coords.accuracy)) : '?'}m
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.noLocationContainer}>
                                    <Text style={styles.noLocationIcon}>📍</Text>
                                    <Text style={styles.noLocationText}>
                                        Position non disponible
                                    </Text>
                                </View>
                            )}

                            <View style={styles.actionsContainer}>
                                <Button
                                    mode="contained"
                                    onPress={handleSelectCurrentLocation}
                                    disabled={!location || loading}
                                    style={styles.selectButton}
                                    contentStyle={styles.buttonContent}
                                >
                                    <Text style={styles.buttonIcon}>✅</Text>
                                    <Text style={styles.buttonText}>Utiliser cette position</Text>
                                </Button>

                                <Button
                                    mode="outlined"
                                    onPress={() => setShowMap(true)}
                                    style={styles.mapButton}
                                    contentStyle={styles.buttonContent}
                                >
                                    <Text style={styles.buttonIconOutlined}>🗺️</Text>
                                    <Text style={[styles.buttonText, { color: theme.colors.primary }]}>
                                        Sélectionner sur carte
                                    </Text>
                                </Button>

                                <Button
                                    mode="outlined"
                                    onPress={getCurrentLocation}
                                    disabled={loading}
                                    style={styles.refreshButton}
                                    contentStyle={styles.buttonContent}
                                >
                                    <Text style={styles.buttonIconOutlined}>🔄</Text>
                                    <Text style={[styles.buttonText, { color: theme.colors.primary }]}>
                                        Actualiser
                                    </Text>
                                </Button>
                            </View>
                        </View>
                    </Card>

                    {currentLocation && (
                        <Card style={styles.currentCard}>
                            <View style={styles.cardContent}>
                                <Title style={styles.currentTitle}>Position actuelle</Title>
                                <View style={styles.coordinatesContainer}>
                                    <Text style={styles.pinIcon}>📌</Text>
                                    <Text style={styles.coordinatesText}>
                                        {formatCoordinates(currentLocation.lat, currentLocation.lng)}
                                    </Text>
                                </View>
                            </View>
                        </Card>
                    )}
                </View>
            </View>

            {/* Modal de carte interactive */}
            <Modal
                visible={showMap}
                animationType="slide"
                presentationStyle="fullScreen"
            >
                <InteractiveMap
                    initialLocation={currentLocation ? {
                        latitude: currentLocation.lat,
                        longitude: currentLocation.lng
                    } : undefined}
                    onLocationSelect={(location) => {
                        onSelect({
                            lat: location.latitude,
                            lng: location.longitude,
                            radius: location.radius,
                            zoneType: location.zoneType
                        });
                        setShowMap(false);
                    }}
                    onClose={() => setShowMap(false)}
                    showRadiusSelector={true}
                    allowZoneSelection={true}
                />
            </Modal>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    closeButton: {
        padding: 8,
    },
    closeIcon: {
        fontSize: 24,
    },
    locationIcon: {
        fontSize: 32,
        textAlign: 'center',
    },
    mapIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    checkIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    noLocationIcon: {
        fontSize: 32,
        textAlign: 'center',
        opacity: 0.5,
    },
    buttonIcon: {
        fontSize: 20,
        marginRight: 8,
        color: 'white',
    },
    buttonIconOutlined: {
        fontSize: 20,
        marginRight: 8,
    },
    pinIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    card: {
        marginBottom: 16,
        elevation: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
    },
    cardContent: {
        padding: 16,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    loadingText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
    },
    locationInfo: {
        marginBottom: 20,
    },
    coordinatesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f0f8ff',
        borderRadius: 8,
    },
    coordinatesText: {
        fontSize: 14,
        color: theme.colors.text,
        marginLeft: 8,
        fontFamily: 'monospace',
    },
    accuracyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    accuracyText: {
        fontSize: 12,
        color: '#4CAF50',
        marginLeft: 4,
    },
    noLocationContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    noLocationText: {
        fontSize: 14,
        color: '#9E9E9E',
        marginTop: 8,
    },
    actionsContainer: {
        gap: 12,
    },
    selectButton: {
        backgroundColor: theme.colors.primary,
    },
    mapButton: {
        borderColor: theme.colors.primary,
    },
    refreshButton: {
        borderColor: theme.colors.primary,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
        color: 'white',
    },
    currentCard: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    currentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
});

export default GPSSelector;

