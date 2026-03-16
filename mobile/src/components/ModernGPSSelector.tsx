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
import LocationSelector, { LocationObject } from './LocationSelector';
import SafeIcon from './SafeIcon';
import { NativeButton, NativeCard } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    title={t('modernGPSSelector.selectionDeLocalisationGps')}
}) => {
        const { t } = useLanguageSafe();
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
                    t('modernGPSSelector.laccesALaLocalisationEstNecessairePourUtiliser'),
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
                const geocodeResult = await Location.reverseGeocodeAsync(newLocation as any);
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

    // ✅ AMÉLIORÉ: Gérer la sélection d'un lieu via LocationSelector avec géocodage automatique
    const handleLocationSelect = async (location: LocationObject) => {
        setLoading(true);
        try {
            let coords = location.coordinates;
            let locationToUse = location;

            // ✅ NOUVEAU: Si les coordonnées ne sont pas disponibles, géocoder le lieu
            if (!coords?.lat || !coords?.lng) {
                const locationText = location.raw || location.place_name || '';
                if (locationText) {
                    console.log('[ModernGPSSelector] Géocodage du lieu:', locationText);
                    try {
                        // Utiliser expo-location pour géocoder
                        const geocodeResults = await Location.geocodeAsync(locationText);
                        if (geocodeResults && geocodeResults.length > 0) {
                            const firstResult = geocodeResults[0];
                            coords = {
                                lat: firstResult.latitude,
                                lng: firstResult.longitude
                            };
                            // Mettre à jour location avec les coordonnées
                            locationToUse = {
                                ...location,
                                coordinates: coords
                            };
                            console.log('[ModernGPSSelector] ✅ Coordonnées obtenues:', coords);
                        } else {
                            throw new Error('Aucun résultat de géocodage');
                        }
                    } catch (geocodeError) {
                        console.error('[ModernGPSSelector] Erreur géocodage:', geocodeError);
                        Alert.alert(
                            'Erreur',
                            'Impossible de trouver les coordonnées de ce lieu. Veuillez sélectionner une position sur la carte.'
                        );
                        setLoading(false);
                        return;
                    }
                } else {
                    Alert.alert('Erreur', 'Nom de lieu invalide');
                    setLoading(false);
                    return;
                }
            }

            if (coords?.lat && coords?.lng) {
                const newLocation = {
                    lat: coords.lat,
                    lng: coords.lng
                };
                setSelectedLocation(newLocation);
                setSearchLocation(locationToUse);
                setSelectedAddress(locationToUse.raw || locationToUse.place_name || '');

                // ✅ AMÉLIORÉ: Repositionner la carte automatiquement avec zoom adapté
                // Le zoom sera adapté selon le type de lieu (établissement, quartier, ville, pays)
                setTimeout(() => {
                    if (mapRef.current) {
                        // ✅ AMÉLIORÉ: Utiliser les types Google Places au lieu du hardcodage
                        // Importer la fonction de mapping depuis LocationSelector (ou créer une version locale)
                        const mapGoogleTypesToLocalType = (googleTypes?: string[]): 'city' | 'neighborhood' | 'establishment' | 'country' => {
                            if (!googleTypes || googleTypes.length === 0) {
                                return 'city';
                            }
                            const establishmentTypes = ['establishment', 'point_of_interest', 'restaurant', 'food', 'cafe', 'bar', 'hospital', 'pharmacy', 'store', 'shopping_mall', 'bank', 'airport', 'train_station', 'church', 'mosque', 'stadium', 'movie_theater', 'museum', 'library', 'park', 'hotel', 'lodging'];
                            const neighborhoodTypes = ['sublocality', 'sublocality_level_1', 'neighborhood'];
                            const cityTypes = ['locality', 'administrative_area_level_2'];
                            const countryTypes = ['country', 'administrative_area_level_1'];

                            if (googleTypes.some(type => establishmentTypes.includes(type))) return 'establishment';
                            if (googleTypes.some(type => neighborhoodTypes.includes(type))) return 'neighborhood';
                            if (googleTypes.some(type => cityTypes.includes(type))) return 'city';
                            if (googleTypes.some(type => countryTypes.includes(type))) return 'country';
                            return 'city';
                        };

                        // ✅ Utiliser types Google Places si disponibles, sinon fallback sur détection manuelle
                        const placeType = locationToUse.google_types
                            ? mapGoogleTypesToLocalType(locationToUse.google_types)
                            : (() => {
                                // Fallback: détection manuelle si types non disponibles
                                const locationText = (locationToUse.raw || locationToUse.place_name || '').toLowerCase();
                                const isQuartier = !!(locationToUse.components?.quartier);
                                const isVille = !!(locationToUse.components?.ville && !locationToUse.components?.quartier);
                                const isPays = !!(locationToUse.components?.pays && !locationToUse.components?.ville);
                                if (isQuartier) return 'neighborhood';
                                if (isVille) return 'city';
                                if (isPays) return 'country';
                                return 'city';
                            })();

                        // ✅ Calcul du zoom selon le type de lieu (utilise types Google)
                        let latitudeDelta: number;
                        let longitudeDelta: number;

                        switch (placeType) {
                            case 'establishment':
                                // Établissement : zoom très proche (~200m) pour position précise
                                latitudeDelta = 0.002;
                                longitudeDelta = 0.002;
                                break;
                            case 'neighborhood':
                                // Quartier : zoom proche (~500m)
                                latitudeDelta = 0.005;
                                longitudeDelta = 0.005;
                                break;
                            case 'city':
                                // Ville : zoom moyen (~2km)
                                latitudeDelta = 0.02;
                                longitudeDelta = 0.02;
                                break;
                            case 'country':
                                // Pays : zoom large (~50km)
                                latitudeDelta = 0.5;
                                longitudeDelta = 0.5;
                                break;
                            default:
                                // Par défaut : zoom moyen (~1km)
                                latitudeDelta = 0.01;
                                longitudeDelta = 0.01;
                        }

                        console.log('[ModernGPSSelector] Recentrage carte:', {
                            coords,
                            type: placeType,
                            zoom: { latitudeDelta, longitudeDelta }
                        });

                        mapRef.current.animateToRegion({
                            latitude: coords.lat,
                            longitude: coords.lng,
                            latitudeDelta,
                            longitudeDelta,
                        }, 800); // Animation de 800ms pour un mouvement fluide
                    }
                }, 100); // Réduire le délai pour une réaction plus rapide
            } else {
                Alert.alert('Erreur', 'Coordonnées GPS non disponibles pour ce lieu');
            }
        } catch (error) {
            console.error('[ModernGPSSelector] Erreur sélection lieu:', error);
            Alert.alert('Erreur', 'Impossible de traiter ce lieu');
        } finally {
            setLoading(false);
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
                                title={t('modernGPSSelector.maPosition')}
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
                                    placeholder={t('modernGPSSelector.villeQuartierLieuSite')}
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
                                    title={t('modernGPSSelector.confirmer')}
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
