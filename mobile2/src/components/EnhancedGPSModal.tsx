// Modal GPS amélioré avec interface réaliste comme le frontend
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface EnhancedGPSModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (coordinates: {
        lat: number;
        lng: number;
        radius?: number;
        zoneType?: 'point' | 'circle' | 'rectangle' | 'polygon';
        address?: string;
    }) => void;
    currentLocation?: { lat: number; lng: number } | null;
    title?: string;
}

const EnhancedGPSModal: React.FC<EnhancedGPSModalProps> = ({
    visible,
    onClose,
    onSelect,
    currentLocation,
    title = 'Sélection de localisation GPS'
}) => {
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(currentLocation || null);
    const [loading, setLoading] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [address, setAddress] = useState('');
    const [radius, setRadius] = useState(50);
    const [zoneType, setZoneType] = useState<'point' | 'circle' | 'rectangle' | 'polygon'>('point');
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');
    const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid'>('satellite');

    // Demander les permissions au montage
    useEffect(() => {
        if (visible) {
            requestLocationPermission();
        }
    }, [visible]);

    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setPermissionGranted(status === 'granted');

            if (status !== 'granted') {
                Alert.alert(
                    'Permission requise',
                    'L\'accès à la localisation est nécessaire pour utiliser cette fonctionnalité.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Erreur demande permission:', error);
        }
    };

    const getCurrentLocation = async () => {
        if (!permissionGranted) {
            Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation.');
            return;
        }

        setLoading(true);
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
            });

            const { latitude, longitude } = location.coords;
            setSelectedLocation({ lat: latitude, lng: longitude });

            // Géocodage inverse pour obtenir l'adresse
            const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude,
                longitude
            });

            if (reverseGeocode.length > 0) {
                const addr = reverseGeocode[0];
                const fullAddress = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                setAddress(fullAddress);
            }

        } catch (error) {
            console.error('Erreur géolocalisation:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle.');
        } finally {
            setLoading(false);
        }
    };

    const searchAddress = async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const results = await Location.geocodeAsync(searchQuery);
            setSearchResults(results);
        } catch (error) {
            console.error('Erreur recherche adresse:', error);
            Alert.alert('Erreur', 'Impossible de rechercher cette adresse.');
        } finally {
            setLoading(false);
        }
    };

    const selectSearchResult = (result: any) => {
        setSelectedLocation({ lat: result.latitude, lng: result.longitude });
        setAddress(searchQuery);
        setSearchResults([]);
    };

    const setManualCoordinates = () => {
        const lat = parseFloat(manualLat);
        const lng = parseFloat(manualLng);

        if (isNaN(lat) || isNaN(lng)) {
            Alert.alert('Erreur', 'Veuillez entrer des coordonnées valides.');
            return;
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            Alert.alert('Erreur', 'Coordonnées GPS invalides.');
            return;
        }

        setSelectedLocation({ lat, lng });
        setAddress(`Coordonnées: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    };

    const clearSelection = () => {
        setSelectedLocation(null);
        setAddress('');
        setSearchQuery('');
        setSearchResults([]);
        setManualLat('');
        setManualLng('');
    };

    const confirmSelection = () => {
        if (!selectedLocation) {
            Alert.alert('Erreur', 'Veuillez sélectionner une position.');
            return;
        }

        onSelect({
            lat: selectedLocation.lat,
            lng: selectedLocation.lng,
            radius: zoneType === 'circle' ? radius : undefined,
            zoneType,
            address: address || undefined
        });
    };

    const getMapStyleText = () => {
        switch (mapStyle) {
            case 'satellite': return 'Satellite';
            case 'hybrid': return 'Hybride';
            default: return 'Standard';
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>{title}</Text>
                        <View style={styles.headerIcons}>
                            <Text style={styles.headerIcon}>📍</Text>
                            <Text style={styles.headerIcon}>🗺️</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {/* Panneau de contrôle gauche */}
                    <View style={styles.controlPanel}>
                        {/* Instructions */}
                        <View style={styles.instructionsBox}>
                            <View style={styles.instructionsHeader}>
                                <Text style={styles.instructionsIcon}>📋</Text>
                                <Text style={styles.instructionsTitle}>Instructions</Text>
                            </View>
                            <View style={styles.instructionsList}>
                                <Text style={styles.instructionItem}>• Cliquez sur la carte pour sélectionner un point</Text>
                                <Text style={styles.instructionItem}>• Dessinez une zone avec l'outil polygone (icône crayon)</Text>
                                <Text style={styles.instructionItem}>• Recherchez une adresse dans la barre de recherche</Text>
                                <Text style={styles.instructionItem}>• Utilisez "Ma Position" pour votre GPS actuel</Text>
                            </View>
                        </View>

                        {/* Bouton Ma Position GPS */}
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={getCurrentLocation}
                            disabled={loading}
                        >
                            <View style={styles.gpsButtonContent}>
                                <Text style={styles.gpsButtonIcon}>🎯</Text>
                                <Text style={styles.gpsButtonText}>Ma Position GPS</Text>
                                <Text style={styles.gpsButtonPin}>📍</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Recherche d'adresse */}
                        <View style={styles.searchSection}>
                            <View style={styles.searchHeader}>
                                <Text style={styles.searchLabel}>recherche</Text>
                            </View>
                            <View style={styles.searchContainer}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Rechercher une adresse..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    onSubmitEditing={searchAddress}
                                />
                                <TouchableOpacity
                                    style={styles.searchButton}
                                    onPress={searchAddress}
                                >
                                    <Text style={styles.searchButtonText}>OK</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Résultats de recherche */}
                            {searchResults.length > 0 && (
                                <View style={styles.searchResults}>
                                    {searchResults.slice(0, 3).map((result, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={styles.searchResultItem}
                                            onPress={() => selectSearchResult(result)}
                                        >
                                            <Text style={styles.searchResultText}>
                                                {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Statut de sélection */}
                        <View style={styles.statusSection}>
                            {selectedLocation ? (
                                <View style={styles.statusSelected}>
                                    <View style={styles.statusHeader}>
                                        <Text style={styles.statusIcon}>✅</Text>
                                        <Text style={styles.statusTitle}>Position sélectionnée</Text>
                                    </View>
                                    <Text style={styles.statusCoords}>
                                        {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                                    </Text>
                                    {address && (
                                        <Text style={styles.statusAddress}>{address}</Text>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.statusEmpty}>
                                    <View style={styles.statusHeader}>
                                        <Text style={styles.statusIcon}>⚠️</Text>
                                        <Text style={styles.statusTitle}>Aucune position sélectionnée</Text>
                                    </View>
                                    <Text style={styles.statusText}>
                                        Cliquez sur la carte ou utilisez la recherche pour sélectionner une position
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Boutons d'action */}
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={clearSelection}
                            >
                                <Text style={styles.clearButtonIcon}>🗑️</Text>
                                <Text style={styles.clearButtonText}>Effacer</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.confirmButton, !selectedLocation && styles.confirmButtonDisabled]}
                                onPress={confirmSelection}
                                disabled={!selectedLocation}
                            >
                                <Text style={styles.confirmButtonIcon}>✅</Text>
                                <Text style={styles.confirmButtonText}>Confirmer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Panneau de carte droite */}
                    <View style={styles.mapPanel}>
                        {/* Contrôles de carte */}
                        <View style={styles.mapControls}>
                            <View style={styles.mapModeIndicator}>
                                <Text style={styles.mapModeIcon}>📍</Text>
                                <Text style={styles.mapModeText}>Mode: Point</Text>
                            </View>

                            <View style={styles.mapStyleControls}>
                                <TouchableOpacity
                                    style={styles.mapStyleButton}
                                    onPress={() => setMapStyle(mapStyle === 'satellite' ? 'standard' : 'satellite')}
                                >
                                    <Text style={styles.mapStyleText}>{getMapStyleText()}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Zone de carte simulée */}
                        <View style={styles.mapContainer}>
                            <View style={styles.mapPlaceholder}>
                                <Text style={styles.mapPlaceholderText}>🗺️</Text>
                                <Text style={styles.mapPlaceholderTitle}>Vue Satellite</Text>
                                <Text style={styles.mapPlaceholderSubtitle}>
                                    {selectedLocation
                                        ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`
                                        : 'Sélectionnez une position'
                                    }
                                </Text>

                                {/* Points d'intérêt simulés */}
                                <View style={styles.poiContainer}>
                                    <View style={styles.poiItem}>
                                        <Text style={styles.poiIcon}>🏢</Text>
                                        <Text style={styles.poiText}>COMPLEXE LE CIEL chez GK</Text>
                                    </View>
                                    <View style={styles.poiItem}>
                                        <Text style={styles.poiIcon}>🍽️</Text>
                                        <Text style={styles.poiText}>OASIS Boulangerie Superette</Text>
                                    </View>
                                    <View style={styles.poiItem}>
                                        <Text style={styles.poiIcon}>📱</Text>
                                        <Text style={styles.poiText}>YURI TÉLÉCOM Cell phone store</Text>
                                    </View>
                                    <View style={styles.poiItem}>
                                        <Text style={styles.poiIcon}>🌸</Text>
                                        <Text style={styles.poiText}>Rond-point TEKAM</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Contrôles de zoom */}
                            <View style={styles.zoomControls}>
                                <TouchableOpacity style={styles.zoomButton}>
                                    <Text style={styles.zoomButtonText}>+</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.zoomButton}>
                                    <Text style={styles.zoomButtonText}>−</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Attribution Google */}
                        <View style={styles.mapAttribution}>
                            <Text style={styles.attributionText}>Google</Text>
                            <Text style={styles.attributionText}>Keyboard shortcuts</Text>
                            <Text style={styles.attributionText}>Map data ©2025 Imagery ©2025 Airbus, Maxar Technologies</Text>
                            <Text style={styles.attributionText}>Terms</Text>
                        </View>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginRight: 12,
    },
    headerIcons: {
        flexDirection: 'row',
        gap: 4,
    },
    headerIcon: {
        fontSize: 16,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    controlPanel: {
        width: width * 0.4,
        backgroundColor: '#FFFFFF',
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
        padding: 16,
    },
    instructionsBox: {
        backgroundColor: '#EBF8FF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    instructionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    instructionsIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    instructionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E40AF',
    },
    instructionsList: {
        gap: 4,
    },
    instructionItem: {
        fontSize: 12,
        color: '#1E40AF',
        lineHeight: 16,
    },
    gpsButton: {
        backgroundColor: '#10B981',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    gpsButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gpsButtonIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    gpsButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        flex: 1,
        textAlign: 'center',
    },
    gpsButtonPin: {
        fontSize: 20,
    },
    searchSection: {
        marginBottom: 16,
    },
    searchHeader: {
        marginBottom: 8,
    },
    searchLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
    },
    searchInput: {
        flex: 1,
        padding: 12,
        fontSize: 14,
        color: '#374151',
    },
    searchButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopRightRadius: 7,
        borderBottomRightRadius: 7,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    searchResults: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
    },
    searchResultItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    searchResultText: {
        fontSize: 14,
        color: '#374151',
    },
    statusSection: {
        marginBottom: 16,
    },
    statusSelected: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: 8,
        padding: 12,
    },
    statusEmpty: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 8,
        padding: 12,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    statusTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    statusCoords: {
        fontSize: 12,
        color: '#059669',
        fontFamily: 'monospace',
        marginBottom: 4,
    },
    statusAddress: {
        fontSize: 12,
        color: '#059669',
    },
    statusText: {
        fontSize: 12,
        color: '#DC2626',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    clearButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 12,
    },
    clearButtonIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    clearButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    confirmButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        borderRadius: 8,
        padding: 12,
    },
    confirmButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    confirmButtonIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    mapPanel: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    mapControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    mapModeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    mapModeIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    mapModeText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    mapStyleControls: {
        flexDirection: 'row',
        gap: 8,
    },
    mapStyleButton: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    mapStyleText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    mapPlaceholder: {
        flex: 1,
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    mapPlaceholderText: {
        fontSize: 48,
        marginBottom: 16,
    },
    mapPlaceholderTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    mapPlaceholderSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 24,
    },
    poiContainer: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        gap: 8,
    },
    poiItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    poiIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    poiText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    zoomControls: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        gap: 8,
    },
    zoomButton: {
        width: 40,
        height: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    zoomButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
    },
    mapAttribution: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    attributionText: {
        fontSize: 10,
        color: '#9CA3AF',
    },
});

export default EnhancedGPSModal;