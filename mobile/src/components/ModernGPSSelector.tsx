import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';
import InteractiveMapView, { InteractiveMapViewRef } from './InteractiveMapView';
import { NativeButton, NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import LocationSelector, { LocationObject } from './LocationSelector';

const { width, height } = Dimensions.get('window');

interface ModernGPSSelectorProps {
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

const ModernGPSSelector: React.FC<ModernGPSSelectorProps> = ({
    visible,
    onClose,
    onSelect,
    currentLocation,
    title = 'Sélection de localisation GPS'
}) => {
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(currentLocation || null);
    const [loading, setLoading] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [searchLocation, setSearchLocation] = useState<LocationObject | string>(''); // ✅ NOUVEAU: Utiliser LocationObject
    const [selectedAddress, setSelectedAddress] = useState<string>(''); // ✅ NOUVEAU: Adresse formatée
    const mapRef = useRef<InteractiveMapViewRef>(null); // ✅ NOUVEAU: Ref pour repositionner la carte
    const [zoneType, setZoneType] = useState<'point' | 'circle' | 'rectangle' | 'polygon'>('point');
    const [radius, setRadius] = useState(50);
    const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid'>('satellite');

    useEffect(() => {
        if (visible) {
            requestLocationPermission();
        }
    }, [visible]);

    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission requise',
                    'L\'accès à la localisation est nécessaire pour utiliser cette fonctionnalité.',
                    [{ text: 'OK' }]
                );
                return;
            }
            setPermissionGranted(true);
        } catch (error) {
            console.error('Erreur permission GPS:', error);
            Alert.alert('Erreur', 'Impossible d\'accéder à la localisation');
        }
    };

    const getCurrentLocation = async () => {
        try {
            setLoading(true);
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const newLocation = {
                lat: location.coords.latitude,
                lng: location.coords.longitude
            };

            setSelectedLocation(newLocation);

            // Géocodage inverse pour obtenir l'adresse
            try {
                const geocodeResult = await Location.reverseGeocodeAsync(newLocation);
                if (geocodeResult.length > 0) {
                    const address = geocodeResult[0];
                    const formattedAddress = `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim();
                    console.log('[ModernGPSSelector] Adresse trouvée:', formattedAddress);
                }
            } catch (geocodeError) {
                console.warn('[ModernGPSSelector] Erreur géocodage inverse:', geocodeError);
            }

        } catch (error) {
            console.error('Erreur GPS:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
        } finally {
            setLoading(false);
        }
    };

    // ✅ NOUVEAU: Gérer la sélection d'un lieu via LocationSelector
    const handleLocationSelect = (location: LocationObject) => {
        const coords = location.coordinates;
        if (coords?.lat && coords?.lng) {
            const newLocation = {
                lat: coords.lat,
                lng: coords.lng
            };
            setSelectedLocation(newLocation);
            setSearchLocation(location);
            setSelectedAddress(location.raw || location.place_name || '');
            
            // ✅ NOUVEAU: Repositionner la carte automatiquement
            // Le zoom sera adapté selon le type de lieu (quartier vs ville)
            setTimeout(() => {
                if (mapRef.current) {
                    // Déterminer le zoom selon le type de lieu
                    const isQuartier = !!(location.components?.quartier);
                    const isVille = !!(location.components?.ville && !location.components?.quartier);
                    
                    // Zoom plus proche pour quartier, plus large pour ville
                    const latitudeDelta = isQuartier ? 0.005 : (isVille ? 0.02 : 0.01); // Quartier: ~500m, Ville: ~2km, Autre: ~1km
                    const longitudeDelta = isQuartier ? 0.005 : (isVille ? 0.02 : 0.01);
                    
                    mapRef.current.animateToRegion({
                        latitude: coords.lat,
                        longitude: coords.lng,
                        latitudeDelta,
                        longitudeDelta,
                    }, 500); // Animation de 500ms
                }
            }, 300);
        } else {
            Alert.alert('Erreur', 'Coordonnées GPS non disponibles pour ce lieu');
        }
    };

    const handleConfirmSelection = () => {
        if (selectedLocation) {
            onSelect({
                lat: selectedLocation.lat,
                lng: selectedLocation.lng,
                radius: zoneType === 'circle' ? radius : undefined,
                zoneType: zoneType,
                address: selectedAddress || (typeof searchLocation === 'string' ? searchLocation : searchLocation.raw) || undefined
            });
            onClose();
        } else {
            Alert.alert('Erreur', 'Veuillez sélectionner une position');
        }
    };

    const handleClearSelection = () => {
        setSelectedLocation(null);
        setSearchLocation('');
        setSelectedAddress('');
    };

    const formatCoordinates = (lat: number, lng: number) => {
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
                {/* Header */}
                <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.header}
                >
                    <View style={styles.headerContent}>
                        <SafeIcon name="map-pin" size={20} color="#FFFFFF" />
                        <SafeIcon name="map" size={20} color="#FFFFFF" />
                        <Text style={styles.headerTitle}>{title}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </LinearGradient>

                <View style={styles.content}>
                    {/* Contrôles Horizontaux en Haut */}
                    <View style={styles.topPanel}>
                        {/* Ligne 1: Bouton GPS + Recherche */}
                        <View style={styles.topRow}>
                            <NativeButton
                                title="Ma Position"
                                onPress={getCurrentLocation}
                                disabled={loading || !permissionGranted}
                                variant="primary"
                                size="small"
                                style={styles.gpsButtonCompact}
                                icon="target"
                            />

                            <View style={styles.searchSectionCompact}>
                                <LocationSelector
                                    label=""
                                    value={searchLocation}
                                    onSelect={handleLocationSelect}
                                    placeholder="Ville, quartier, pays..."
                                    enrichWithBackend={true}
                                />
                            </View>
                        </View>

                        {/* Ligne 2: Modes de sélection */}
                        <View style={styles.modesRowCompact}>
                            <Text style={styles.modesLabelCompact}>Mode:</Text>
                            {[
                                { key: 'point', label: 'Point', icon: 'map-pin' },
                                { key: 'circle', label: 'Zone', icon: 'circle' },
                                { key: 'rectangle', label: 'Rect', icon: 'square' },
                                { key: 'polygon', label: 'Poly', icon: 'edit' }
                            ].map((mode) => (
                                <TouchableOpacity
                                    key={mode.key}
                                    style={[
                                        styles.modeButtonCompact,
                                        zoneType === mode.key && styles.modeButtonActiveCompact
                                    ]}
                                    onPress={() => setZoneType(mode.key as any)}
                                >
                                    <SafeIcon name={mode.icon} size={14} color={zoneType === mode.key ? '#FFF' : modernColors.primary} />
                                    <Text style={[
                                        styles.modeButtonTextCompact,
                                        zoneType === mode.key && styles.modeButtonTextActiveCompact
                                    ]}>{mode.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Ligne 3: Statut de sélection */}
                        <View style={styles.statusRowCompact}>
                            <SafeIcon
                                name={selectedLocation ? "check-circle" : "alert-triangle"}
                                size={14}
                                color={selectedLocation ? modernColors.success : modernColors.warning}
                            />
                            <Text style={styles.statusTextCompact} numberOfLines={1}>
                                {selectedLocation
                                    ? formatCoordinates(selectedLocation.lat, selectedLocation.lng)
                                    : 'Cliquez sur la carte'}
                            </Text>
                            {zoneType === 'circle' && (
                                <View style={styles.radiusControlsCompact}>
                                    <TouchableOpacity
                                        style={styles.radiusButtonCompact}
                                        onPress={() => setRadius(Math.max(10, radius - 10))}
                                    >
                                        <SafeIcon name="minus" size={12} color={modernColors.primary} />
                                    </TouchableOpacity>
                                    <Text style={styles.radiusValueCompact}>{radius}m</Text>
                                    <TouchableOpacity
                                        style={styles.radiusButtonCompact}
                                        onPress={() => setRadius(Math.min(1000, radius + 10))}
                                    >
                                        <SafeIcon name="plus" size={12} color={modernColors.primary} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Boutons d'action */}
                            <View style={styles.actionsCompact}>
                                <NativeButton
                                    title="Effacer"
                                    onPress={handleClearSelection}
                                    variant="outline"
                                    size="small"
                                    style={styles.clearButtonCompact}
                                    icon="trash-2"
                                />
                                <NativeButton
                                    title="Confirmer"
                                    onPress={handleConfirmSelection}
                                    disabled={!selectedLocation}
                                    variant="primary"
                                    size="small"
                                    style={styles.confirmButtonCompact}
                                    icon="check"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Carte Interactive - Pleine largeur en bas */}
                    <View style={styles.mapContainerFull}>
                        <NativeCard style={styles.mapCard}>
                            <InteractiveMapView
                                ref={mapRef}
                                selectedLocation={selectedLocation}
                                onLocationSelect={(location) => setSelectedLocation(location)}
                                zoneType={zoneType}
                                radius={radius}
                                mapStyle={mapStyle}
                                showBuildings={true}
                                showTraffic={true}
                            />
                        </NativeCard>
                    </View>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        flexDirection: 'column',
    },
    topPanel: {
        padding: 12,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        gap: 8,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    gpsButtonCompact: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 110,
    },
    searchSectionCompact: {
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    searchInputCompact: {
        flex: 1,
        height: 36,
    },
    searchButtonCompact: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 50,
    },
    modesRowCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'nowrap',
    },
    modesLabelCompact: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginRight: 4,
    },
    modeButtonCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    modeButtonActiveCompact: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    modeButtonTextCompact: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.text,
    },
    modeButtonTextActiveCompact: {
        color: '#FFFFFF',
    },
    statusRowCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: modernColors.background,
        borderRadius: 8,
        flexWrap: 'nowrap',
    },
    statusTextCompact: {
        flex: 1,
        fontSize: 11,
        color: modernColors.textSecondary,
        fontFamily: 'monospace',
    },
    radiusControlsCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginRight: 8,
    },
    radiusButtonCompact: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radiusValueCompact: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.primary,
        minWidth: 35,
        textAlign: 'center',
    },
    actionsCompact: {
        flexDirection: 'row',
        gap: 6,
    },
    clearButtonCompact: {
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    confirmButtonCompact: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    mapContainerFull: {
        flex: 1,
        padding: 12,
    },
    instructionsCard: {
        padding: 16,
    },
    instructionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    instructionsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    instructionsList: {
        gap: 8,
    },
    instructionItem: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
    },
    gpsButton: {
        backgroundColor: modernColors.success,
    },
    searchSection: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-end',
    },
    searchInput: {
        flex: 1,
    },
    searchButton: {
        minWidth: 60,
    },
    statusCard: {
        padding: 16,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    statusTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    selectedLocationInfo: {
        gap: 4,
    },
    coordinatesText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontFamily: 'monospace',
    },
    addressText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '500',
    },
    noSelectionText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    modesCard: {
        padding: 16,
    },
    modesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    modesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    modeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: modernStyles.borderRadius.small,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
        gap: 6,
    },
    modeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primaryDark,
    },
    modeButtonText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    radiusCard: {
        padding: 16,
    },
    radiusTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    radiusControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    radiusButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    radiusValue: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        minWidth: 60,
        textAlign: 'center',
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    clearButton: {
        flex: 1,
    },
    confirmButton: {
        flex: 1,
    },
    mapCard: {
        flex: 1,
        padding: 0,
        overflow: 'hidden',
    },
    mapStyleCard: {
        padding: 16,
    },
    mapStyleTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    mapStyleContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    mapStyleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: modernStyles.borderRadius.small,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
        gap: 4,
    },
    mapStyleButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primaryDark,
    },
    mapStyleButtonText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    mapStyleButtonTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

export default ModernGPSSelector;
