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
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import ErrorBoundary from './ErrorBoundary';
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
            // ✅ CORRECTION CRASH: Timeout pour éviter les blocages
            const permissionPromise = Location.requestForegroundPermissionsAsync();
            const timeoutPromise = new Promise<{ status: string }>((_, reject) =>
                setTimeout(() => reject(new Error('GPS permission timeout')), 10000)
            );

            const { status } = await Promise.race([permissionPromise, timeoutPromise as Promise<Location.LocationPermissionResponse>]);
            setPermissionGranted(status === 'granted');
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation pour utiliser cette fonctionnalité.');
            }
        } catch (error: any) {
            console.error('[ModernGPSModal] ❌ Erreur permission:', error);
            if (error?.message?.includes('timeout')) {
                console.warn('[ModernGPSModal] ⚠️ Timeout permission GPS');
                setPermissionGranted(false);
            }
        }
    };

    const handleGetCurrentLocation = async () => {
        if (!permissionGranted) {
            Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation.');
            return;
        }

        setLoading(true);
        try {
            // ✅ CORRECTION CRASH: Timeout pour éviter les blocages
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced, // Moins précis mais plus rapide
            });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('GPS location timeout')), 15000)
            );

            const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;

            const newLocation = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            };

            setSelectedLocation(newLocation);

            // ✅ CORRECTION CRASH: Timeout pour le géocodage inverse
            try {
                const geocodePromise = Location.reverseGeocodeAsync(newLocation);
                const geocodeTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Geocoding timeout')), 10000)
                );

                const reverseGeocode = await Promise.race([geocodePromise, geocodeTimeout]) as Location.LocationGeocodedAddress[];

                if (reverseGeocode && reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    const fullAddress = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                    setAddress(fullAddress);
                }
            } catch (geocodeError: any) {
                console.warn('[ModernGPSModal] ⚠️ Géocodage échoué:', geocodeError?.message);
                // Utiliser les coordonnées comme fallback
                setAddress(`${newLocation.lat.toFixed(6)}, ${newLocation.lng.toFixed(6)}`);
            }

        } catch (error: any) {
            console.error('[ModernGPSModal] ❌ Erreur géolocalisation:', error);
            if (error?.message?.includes('timeout')) {
                Alert.alert('Timeout GPS', 'La géolocalisation prend trop de temps. Veuillez réessayer.');
            } else {
                Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle.');
            }
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
            if ((selectedPolygon || []).length < 3) {
                Alert.alert('Erreur', 'Veuillez sélectionner au moins 3 points pour créer une zone.');
                return;
            }
            const coordsString = (selectedPolygon || []).map(p => `${p.lat},${p.lng}`).join('|');
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
                        <Text style={styles.layerButtonText}>{getMapStyleText()}</Text>
                    </TouchableOpacity>
                </LinearGradient>

                {/* ✅ REFONTE COMPLÈTE: Barre de contrôles ultra-intuitive */}
                <View style={styles.topControlBar}>
                    {/* Mode de sélection - ULTRA CLAIR */}
                    <View style={[styles.topControlSection, { flex: 1 }]}>
                        <View style={styles.controlHeader}>
                            <SafeIcon name="target" size={14} color={modernColors.primary} />
                            <Text style={styles.topControlLabel}>MODE</Text>
                        </View>
                        <View style={styles.topModeButtons}>
                            <TouchableOpacity
                                style={[
                                    styles.topModeButton,
                                    zoneType === 'point' && styles.topModeButtonActive
                                ]}
                                onPress={() => setZoneType('point')}
                            >
                                <SafeIcon 
                                    name="map-pin" 
                                    size={18} 
                                    color={zoneType === 'point' ? '#FFFFFF' : modernColors.primary} 
                                />
                                <Text style={[
                                    styles.topModeButtonText,
                                    zoneType === 'point' && styles.topModeButtonTextActive
                                ]}>
                                    Point
                                </Text>
                            </TouchableOpacity>

                            {allowZoneSelection && (
                                <TouchableOpacity
                                    style={[
                                        styles.topModeButton,
                                        zoneType === 'polygon' && styles.topModeButtonActive
                                    ]}
                                    onPress={() => setZoneType('polygon')}
                                >
                                    <SafeIcon 
                                        name="square" 
                                        size={18} 
                                        color={zoneType === 'polygon' ? '#FFFFFF' : modernColors.primary} 
                                    />
                                    <Text style={[
                                        styles.topModeButtonText,
                                        zoneType === 'polygon' && styles.topModeButtonTextActive
                                    ]}>
                                        Zone
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Recherche d'adresse - ULTRA CLAIRE */}
                    <View style={[styles.topControlSection, { flex: 2 }]}>
                        <View style={styles.controlHeader}>
                            <SafeIcon name="search" size={14} color={modernColors.success} />
                            <Text style={styles.topControlLabel}>RECHERCHE</Text>
                        </View>
                        <View style={styles.topSearchContainer}>
                            <TextInput
                                style={styles.topSearchInput}
                                placeholder="Entrez une adresse ou un lieu..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#9CA3AF"
                                returnKeyType="search"
                                onSubmitEditing={handleSearch}
                            />
                            <TouchableOpacity
                                style={styles.topSearchButton}
                                onPress={handleSearch}
                                disabled={loading}
                            >
                                <SafeIcon name="search" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Ma position GPS - ULTRA CLAIRE */}
                    <View style={[styles.topControlSection, { flex: 1.2 }]}>
                        <View style={styles.controlHeader}>
                            <SafeIcon name="crosshair" size={14} color={modernColors.warning} />
                            <Text style={styles.topControlLabel}>POSITION</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.topGPSButton}
                            onPress={handleGetCurrentLocation}
                            disabled={loading}
                        >
                            <SafeIcon 
                                name={loading ? "loader" : "crosshair"} 
                                size={22} 
                                color="#FFFFFF" 
                            />
                            <Text style={styles.topGPSButtonText}>
                                {loading ? 'Localisation...' : 'Me localiser'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.content}>
                    {/* Panneau d'informations - SIMPLIFIÉ */}
                    <View style={styles.leftPanel}>

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
                        <ErrorBoundary
                            fallback={
                                <View style={[styles.map, styles.mapErrorContainer]}>
                                    <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                                    <Text style={styles.mapErrorText}>
                                        Impossible de charger la carte
                                    </Text>
                                    <Text style={styles.mapErrorSubtext}>
                                        Vérifiez votre connexion internet et les permissions GPS
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.retryButton}
                                        onPress={() => {
                                            onClose();
                                            // Recharger en rouvrant
                                        }}
                                    >
                                        <SafeIcon name="refresh-cw" size={16} color="#FFFFFF" />
                                        <Text style={styles.retryButtonText}>Réessayer</Text>
                                    </TouchableOpacity>
                                </View>
                            }
                        >
                            <InteractiveMapView
                                selectedLocation={selectedLocation}
                                onLocationSelect={handleLocationSelect}
                                mapStyle={mapStyle}
                                zoneType={zoneType}
                                polygonPoints={selectedPolygon}
                                onPolygonPointsChange={handlePolygonPointsChange}
                                style={styles.map}
                            />
                        </ErrorBoundary>
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
        flexDirection: 'row',
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    layerButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    leftPanel: {
        width: width * 0.22, // ✅ Encore réduit pour donner plus d'espace à la carte
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 10,
        paddingVertical: 12,
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
    },
    // ✅ NOUVEAU: Styles pour la barre de contrôle horizontale
    topControlBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#D1D5DB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
        gap: 16,
    },
    topControlSection: {
        flex: 1,
        minWidth: 0, // ✅ Pour permettre au flex de bien fonctionner
    },
    controlHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    topControlLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#1F2937',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    topModeButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    topModeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 2.5,
        borderColor: modernColors.primary,
        backgroundColor: '#FFFFFF',
        gap: 10, // ✅ Plus d'espace entre icône et texte
        minHeight: 48, // ✅ Cible tactile confortable
        shadowColor: modernColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
    },
    topModeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
        shadowOpacity: 0.4,
        elevation: 5,
    },
    topModeIcon: {
        fontSize: 20, // Ancien style emoji, conservé pour compat
    },
    topModeButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: modernColors.primary,
        letterSpacing: 0.4,
    },
    topModeButtonTextActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
    topSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    topSearchInput: {
        flex: 1,
        height: 46,
        borderWidth: 2.5,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        backgroundColor: '#FFFFFF',
        color: '#111827',
        fontWeight: '600',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    topSearchButton: {
        width: 46,
        height: 46,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: modernColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    topGPSButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        gap: 8,
        shadowColor: modernColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    topGPSIcon: {
        fontSize: 22,
    },
    topGPSButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.4,
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
        fontSize: 14, // ✅ Augmenté de 12 à 14 pour meilleure lisibilité
        fontWeight: '700', // ✅ Plus gras
        color: '#1F2937', // ✅ Plus contrasté
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
        fontSize: 13, // ✅ Augmenté pour meilleure lisibilité
        fontWeight: '700', // ✅ Plus gras
        color: '#111827', // ✅ Plus contrasté
        fontFamily: 'monospace',
        flexWrap: 'wrap',
        textAlign: 'left',
    },
    selectedAddressText: {
        fontSize: 12, // ✅ Augmenté pour meilleure lisibilité
        fontWeight: '600', // ✅ Plus gras
        color: '#374151', // ✅ Plus contrasté
        marginTop: 4,
        flexWrap: 'wrap',
        textAlign: 'left',
        lineHeight: 17,
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
    mapErrorContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        padding: 20,
    },
    mapErrorText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#EF4444',
        marginTop: 16,
        textAlign: 'center',
    },
    mapErrorSubtext: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 20,
        gap: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
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