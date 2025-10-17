import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width, height } = Dimensions.get('window');

interface NewGPSModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (coordinates: { lat: number; lng: number; address?: string }) => void;
    currentLocation?: { lat: number; lng: number; address?: string } | null;
    title?: string;
}

const NewGPSModal: React.FC<NewGPSModalProps> = ({
    visible,
    onClose,
    onSelect,
    currentLocation,
    title = 'Sélectionner une localisation',
}) => {
    const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(
        currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null
    );
    const [loading, setLoading] = useState(false);
    const [address, setAddress] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [mapRegion, setMapRegion] = useState({
        latitude: currentLocation?.lat || 4.031716, // Douala par défaut
        longitude: currentLocation?.lng || 9.817201,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    });

    // Récupérer la position actuelle
    const getCurrentPosition = async () => {
        try {
            setLoading(true);
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert(
                    'Permission refusée',
                    'Nous avons besoin de votre permission pour accéder à votre position'
                );
                setLoading(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const coords = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            };

            setSelectedCoords(coords);
            setMapRegion({
                latitude: coords.lat,
                longitude: coords.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });

            // Géocodage inverse pour obtenir l'adresse
            try {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude: coords.lat,
                    longitude: coords.lng,
                });

                if (reverseGeocode && reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    const addressParts = [];
                    if (addr.district) addressParts.push(addr.district);
                    if (addr.city) addressParts.push(addr.city);
                    if (addr.region) addressParts.push(addr.region);
                    setAddress(addressParts.join(', '));
                }
            } catch (geoError) {
                console.error('Erreur géocodage inverse:', geoError);
                setAddress(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
            }

            setLoading(false);
        } catch (error) {
            console.error('Erreur obtention position:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
            setLoading(false);
        }
    };

    // Géocodage pour recherche par adresse
    const searchAddress = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer une adresse');
            return;
        }

        try {
            setLoading(true);
            const results = await Location.geocodeAsync(searchQuery);

            if (results && results.length > 0) {
                const coords = {
                    lat: results[0].latitude,
                    lng: results[0].longitude,
                };

                setSelectedCoords(coords);
                setMapRegion({
                    latitude: coords.lat,
                    longitude: coords.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });
                setAddress(searchQuery);
            } else {
                Alert.alert('Aucun résultat', 'Aucune position trouvée pour cette adresse');
            }
            setLoading(false);
        } catch (error) {
            console.error('Erreur recherche adresse:', error);
            Alert.alert('Erreur', 'Impossible de trouver cette adresse');
            setLoading(false);
        }
    };

    // Gérer le clic sur la carte
    const handleMapPress = async (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        const coords = { lat: latitude, lng: longitude };

        setSelectedCoords(coords);

        // Géocodage inverse
        try {
            const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            if (reverseGeocode && reverseGeocode.length > 0) {
                const addr = reverseGeocode[0];
                const addressParts = [];
                if (addr.district) addressParts.push(addr.district);
                if (addr.city) addressParts.push(addr.city);
                if (addr.region) addressParts.push(addr.region);
                setAddress(addressParts.join(', '));
            }
        } catch (error) {
            console.error('Erreur géocodage inverse:', error);
            setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
    };

    // Confirmer la sélection
    const handleConfirm = () => {
        if (!selectedCoords) {
            Alert.alert('Erreur', 'Veuillez sélectionner une position sur la carte');
            return;
        }

        onSelect({
            ...selectedCoords,
            address: address || undefined,
        });
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="close" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <View style={styles.closeButton} />
                </View>

                {/* Barre de recherche */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchInputContainer}>
                        <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Rechercher une adresse..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={searchAddress}
                        />
                    </View>
                    <TouchableOpacity
                        style={styles.searchButton}
                        onPress={searchAddress}
                        disabled={loading}
                    >
                        <Text style={styles.searchButtonText}>Rechercher</Text>
                    </TouchableOpacity>
                </View>

                {/* Bouton position actuelle */}
                <TouchableOpacity
                    style={styles.currentLocationButton}
                    onPress={getCurrentPosition}
                    disabled={loading}
                >
                    <SafeIcon name="location" size={20} color="#FFFFFF" />
                    <Text style={styles.currentLocationText}>
                        {loading ? 'Chargement...' : 'Ma position actuelle'}
                    </Text>
                </TouchableOpacity>

                {/* Carte */}
                <View style={styles.mapContainer}>
                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                        </View>
                    )}
                    <MapView
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        region={mapRegion}
                        onRegionChangeComplete={setMapRegion}
                        onPress={handleMapPress}
                        showsUserLocation
                        showsMyLocationButton
                        showsCompass
                        showsScale
                    >
                        {selectedCoords && (
                            <Marker
                                coordinate={{
                                    latitude: selectedCoords.lat,
                                    longitude: selectedCoords.lng,
                                }}
                                title="Position sélectionnée"
                                description={address}
                                pinColor={modernColors.primary}
                            />
                        )}
                    </MapView>
                </View>

                {/* Informations de la sélection */}
                {selectedCoords && (
                    <View style={styles.selectionInfo}>
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
                            <Text style={styles.infoText}>
                                {address || `${selectedCoords.lat.toFixed(6)}, ${selectedCoords.lng.toFixed(6)}`}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Boutons d'action */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.confirmButton, !selectedCoords && styles.confirmButtonDisabled]}
                        onPress={handleConfirm}
                        disabled={!selectedCoords}
                    >
                        <SafeIcon name="check" size={20} color="#FFFFFF" />
                        <Text style={styles.confirmButtonText}>Confirmer</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    closeButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
        backgroundColor: '#FFFFFF',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 16,
        color: modernColors.text,
    },
    searchButton: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 20,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    currentLocationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
        marginHorizontal: 16,
        marginBottom: 16,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    currentLocationText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    mapContainer: {
        flex: 1,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    selectionInfo: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    actionsContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    confirmButton: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    confirmButtonDisabled: {
        backgroundColor: modernColors.textSecondary,
        opacity: 0.5,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default NewGPSModal;




