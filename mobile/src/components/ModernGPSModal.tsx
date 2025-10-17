// @ts-nocheck
import { LinearGradient } from 'expo-linear-gradient';
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
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import InteractiveMapView from './InteractiveMapView';
import SafeIcon from './SafeIcon';

const { width, height } = Dimensions.get('window');

interface ModernGPSModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (coordinates: string) => void; // Format: "lat,lng" ou "lat1,lng1|lat2,lng2|..."
    currentLocation?: { lat: number; lng: number } | null;
    title?: string;
    allowZoneSelection?: boolean;
}

const ModernGPSModal: React.FC<ModernGPSModalProps> = ({
    visible,
    onClose,
    onSelect,
    currentLocation,
    title = 'Sélection de localisation GPS',
    allowZoneSelection = true
}) => {
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(currentLocation || null);
    const [selectedPolygon, setSelectedPolygon] = useState<{ lat: number; lng: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [address, setAddress] = useState('');
    const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid'>('hybrid');
    const [zoneType, setZoneType] = useState<'point' | 'polygon'>('point');

    useEffect(() => {
        if (visible) {
            requestLocationPermission();
            if (currentLocation) {
                setSelectedLocation(currentLocation);
            }
        }
    }, [visible, currentLocation]);

    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setPermissionGranted(status === 'granted');
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation pour utiliser cette fonctionnalité.');
            }
        } catch (error) {
            console.error('Erreur permission:', error);
        }
    };

    const handleGetCurrentLocation = async () => {
        if (!permissionGranted) {
            Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation.');
            return;
        }

        setLoading(true);
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const newLocation = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            };

            setSelectedLocation(newLocation);

            // Géocodage inverse pour obtenir l'adresse
            const reverseGeocode = await Location.reverseGeocodeAsync(newLocation);
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

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const results = await Location.geocodeAsync(searchQuery);
            if (results.length > 0) {
                const result = results[0];
                setSelectedLocation({ lat: result.latitude, lng: result.longitude });
                setAddress(searchQuery);
            } else {
                Alert.alert('Aucun résultat', 'Aucune adresse trouvée pour cette recherche.');
            }
        } catch (error) {
            console.error('Erreur recherche adresse:', error);
            Alert.alert('Erreur', 'Impossible de rechercher cette adresse.');
        } finally {
            setLoading(false);
        }
    };

    const handleLocationSelect = (location: { lat: number; lng: number }) => {
        setSelectedLocation(location);
        setAddress(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
    };

    const handlePolygonPointsChange = (points: { lat: number; lng: number }[]) => {
        setSelectedPolygon(points);
        console.log(`[ModernGPSModal] Points de polygone mis à jour: ${points.length} points`);
    };

    const confirmSelection = () => {
        if (zoneType === 'point') {
            if (!selectedLocation) {
                Alert.alert('Erreur', 'Veuillez sélectionner une position sur la carte.');
                return;
            }
            const coordsString = `${selectedLocation.lat},${selectedLocation.lng}`;
            onSelect(coordsString);
        } else {
            if (selectedPolygon.length < 3) {
                Alert.alert('Erreur', 'Veuillez sélectionner au moins 3 points pour créer une zone.');
                return;
            }
            const coordsString = selectedPolygon.map(p => `${p.lat},${p.lng}`).join('|');
            onSelect(coordsString);
        }
        onClose();
    };

    const toggleMapStyle = () => {
        const styles: ('standard' | 'satellite' | 'hybrid')[] = ['satellite', 'standard', 'hybrid'];
        const currentIndex = styles.indexOf(mapStyle);
        const nextIndex = (currentIndex + 1) % styles.length;
        setMapStyle(styles[nextIndex]);
    };

    const getMapStyleText = () => {
        switch (mapStyle) {
            case 'satellite': return 'Satellite';
            case 'hybrid': return 'Hybride';
            default: return 'Standard';
        }
    };

    const clearPolygon = () => {
        setSelectedPolygon([]);
        setZoneType('point');
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header compact et moderne */}
                <LinearGradient
                    colors={[modernColors.primary, modernColors.primaryDark]}
                    style={styles.header}
                >
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <SafeIcon name="x" size={20} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.headerContent}>
                        <SafeIcon name="map-pin" size={18} color="#FFFFFF" />
                        <Text style={styles.headerTitle}>{title}</Text>
                        <View style={styles.headerIcons}>
                            <SafeIcon name="smartphone" size={14} color="#FFFFFF" />
                            <SafeIcon name="map" size={14} color="#FFFFFF" />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.layerButton} onPress={toggleMapStyle}>
                        <SafeIcon name="layers" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </LinearGradient>

                <View style={styles.content}>
                    {/* Panneau de contrôle gauche - COMPACT */}
                    <View style={styles.leftPanel}>
                        {/* Mode de sélection */}
                        <View style={styles.controlCard}>
                            <View style={styles.cardHeader}>
                                <SafeIcon name="layers" size={14} color={modernColors.primary} />
                                <Text style={styles.cardTitle} numberOfLines={1}>Mode</Text>
                            </View>

                            <View style={styles.selectionModeButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.modeButton,
                                        zoneType === 'point' && styles.modeButtonActive
                                    ]}
                                    onPress={() => setZoneType('point')}
                                >
                                    <SafeIcon name="map-pin" size={14} color={zoneType === 'point' ? '#FFFFFF' : modernColors.primary} />
                                    <Text 
                                        style={[
                                            styles.modeButtonText,
                                            zoneType === 'point' && styles.modeButtonTextActive
                                        ]}
                                        numberOfLines={1}
                                    >
                                        Point
                                    </Text>
                                </TouchableOpacity>

                                {allowZoneSelection && (
                                    <TouchableOpacity
                                        style={[
                                            styles.modeButton,
                                            zoneType === 'polygon' && styles.modeButtonActive
                                        ]}
                                        onPress={() => setZoneType('polygon')}
                                    >
                                        <SafeIcon name="map" size={14} color={zoneType === 'polygon' ? '#FFFFFF' : modernColors.primary} />
                                        <Text 
                                            style={[
                                                styles.modeButtonText,
                                                zoneType === 'polygon' && styles.modeButtonTextActive
                                            ]}
                                            numberOfLines={1}
                                        >
                                            Zone
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Recherche d'adresse */}
                        <View style={styles.controlCard}>
                            <View style={styles.cardHeader}>
                                <SafeIcon name="search" size={14} color={modernColors.primary} />
                                <Text style={styles.cardTitle} numberOfLines={1}>Recherche</Text>
                            </View>

                            <View style={styles.searchContainer}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Adresse..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholderTextColor={modernColors.textSecondary}
                                />
                                <TouchableOpacity
                                    style={styles.searchButton}
                                    onPress={handleSearch}
                                    disabled={loading}
                                >
                                    <SafeIcon name="search" size={14} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Ma position GPS */}
                        <View style={styles.controlCard}>
                            <TouchableOpacity
                                style={styles.gpsButton}
                                onPress={handleGetCurrentLocation}
                                disabled={loading}
                            >
                                <SafeIcon name="map-pin" size={16} color="#FFFFFF" />
                                <Text style={styles.gpsButtonText} numberOfLines={1}>
                                    {loading ? 'Chargement...' : 'Ma Position'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Position sélectionnée */}
                        {selectedLocation && (
                            <View style={styles.controlCard}>
                                <View style={styles.cardHeader}>
                                    <SafeIcon name="check-circle" size={14} color={modernColors.success} />
                                    <Text style={styles.cardTitle} numberOfLines={1}>Sélectionné</Text>
                                </View>

                                <View style={styles.selectedLocationContainer}>
                                    <Text style={styles.selectedLocationText} numberOfLines={1}>
                                        {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                                    </Text>
                                    {address && (
                                        <Text style={styles.selectedAddressText} numberOfLines={2} ellipsizeMode="tail">
                                            {address}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Zone polygon sélectionnée */}
                        {zoneType === 'polygon' && selectedPolygon.length > 0 && (
                            <View style={styles.controlCard}>
                                <View style={styles.cardHeader}>
                                    <SafeIcon name="map" size={14} color={modernColors.warning} />
                                    <Text style={styles.cardTitle} numberOfLines={1}>
                                        Zone ({selectedPolygon.length}pts)
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.clearButton}
                                    onPress={clearPolygon}
                                >
                                    <SafeIcon name="trash-2" size={14} color="#EF4444" />
                                    <Text style={styles.clearButtonText} numberOfLines={1}>Effacer</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Carte interactive - PLUS D'ESPACE */}
                    <View style={styles.mapContainer}>
                        <InteractiveMapView
                            selectedLocation={selectedLocation}
                            onLocationSelect={handleLocationSelect}
                            mapStyle={mapStyle}
                            zoneType={zoneType}
                            polygonPoints={selectedPolygon}
                            onPolygonPointsChange={handlePolygonPointsChange}
                            style={styles.map}
                        />
                    </View>
                </View>

                {/* Actions en bas */}
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.confirmButton,
                            (!selectedLocation && zoneType === 'point') ||
                            (selectedPolygon.length < 3 && zoneType === 'polygon') && styles.confirmButtonDisabled
                        ]}
                        onPress={confirmSelection}
                        disabled={(!selectedLocation && zoneType === 'point') || (selectedPolygon.length < 3 && zoneType === 'polygon')}
                    >
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
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: 50, // Status bar
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 8,
    },
    headerIcons: {
        flexDirection: 'row',
        marginLeft: 8,
        gap: 4,
    },
    layerButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    leftPanel: {
        width: width * 0.38, // Augmenté légèrement pour éviter le texte vertical
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        paddingVertical: 16,
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
    },
    controlCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'nowrap',
    },
    cardTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        marginLeft: 6,
        flexShrink: 1,
        flexWrap: 'nowrap',
    },
    selectionModeButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        backgroundColor: '#FFFFFF',
        gap: 4,
    },
    modeButtonActive: {
        backgroundColor: modernColors.primary,
    },
    modeButtonText: {
        fontSize: 11,
        fontWeight: '500',
        color: modernColors.primary,
        marginLeft: 4,
        textAlign: 'center',
        flexShrink: 0,
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 32,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 12,
        backgroundColor: '#FFFFFF',
    },
    searchButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    gpsButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#FFFFFF',
        marginLeft: 6,
        textAlign: 'center',
        flexShrink: 0,
    },
    selectedLocationContainer: {
        marginTop: 4,
        flexDirection: 'column',
        flexWrap: 'wrap',
    },
    selectedLocationText: {
        fontSize: 10,
        color: modernColors.textSecondary,
        fontFamily: 'monospace',
        flexWrap: 'wrap',
        textAlign: 'left',
    },
    selectedAddressText: {
        fontSize: 10,
        color: modernColors.text,
        marginTop: 2,
        flexWrap: 'wrap',
        textAlign: 'left',
        lineHeight: 14,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#FEF2F2',
        marginTop: 4,
    },
    clearButtonText: {
        fontSize: 10,
        color: '#EF4444',
        marginLeft: 4,
        fontWeight: '500',
        textAlign: 'center',
        flexShrink: 0,
    },
    mapContainer: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    map: {
        flex: 1,
    },
    actionBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default ModernGPSModal;