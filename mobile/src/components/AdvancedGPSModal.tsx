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
import { NativeButton, NativeCard, NativeInput } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

const { width, height } = Dimensions.get('window');

interface AdvancedGPSModalProps {
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

const AdvancedGPSModal: React.FC<AdvancedGPSModalProps> = ({
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
    const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid'>('satellite');
    const [showMap, setShowMap] = useState(false);

    useEffect(() => {
        if (visible) {
            requestLocationPermission();
            if (currentLocation) {
                setSelectedLocation(currentLocation);
                geocodeLocation(currentLocation);
            }
        }
    }, [visible, currentLocation]);

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

            const newLocation = {
                lat: location.coords.latitude,
                lng: location.coords.longitude
            };

            setSelectedLocation(newLocation);
            await geocodeLocation(newLocation);
        } catch (error) {
            console.error('Erreur localisation:', error);
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

    const geocodeLocation = async (location: { lat: number; lng: number }) => {
        try {
            const geocodeResult = await Location.reverseGeocodeAsync({
                latitude: location.lat,
                longitude: location.lng
            });
            if (geocodeResult.length > 0) {
                const addr = geocodeResult[0];
                const formattedAddress = `${addr.street || ''} ${addr.city || ''} ${addr.region || ''}`.trim();
                setAddress(formattedAddress || 'Adresse non trouvée');
            }
        } catch (error) {
            console.warn('Erreur géocodage:', error);
            setAddress('Adresse non trouvée');
        }
    };

    const handleSearchAddress = async () => {
        if (!searchQuery.trim()) return;

        try {
            setLoading(true);
            const geocodeResult = await Location.geocodeAsync(searchQuery);

            if (geocodeResult.length > 0) {
                const location = geocodeResult[0];
                const newLocation = {
                    lat: location.latitude,
                    lng: location.longitude
                };
                setSelectedLocation(newLocation);
                setSearchResults(geocodeResult);
                setAddress(searchQuery);
            } else {
                Alert.alert('Aucun résultat', 'Aucune adresse trouvée pour cette recherche');
            }
        } catch (error) {
            console.error('Erreur recherche adresse:', error);
            Alert.alert('Erreur', 'Impossible de rechercher cette adresse');
        } finally {
            setLoading(false);
        }
    };

    const handleManualCoordinates = () => {
        if (searchQuery.includes(',')) {
            const [latStr, lngStr] = searchQuery.split(',').map(s => s.trim());
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);

            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                const newLocation = { lat, lng };
                setSelectedLocation(newLocation);
                geocodeLocation(newLocation);
                setSearchQuery('');
            } else {
                Alert.alert('Erreur', 'Coordonnées invalides. Format: latitude, longitude');
            }
        }
    };

    const handleConfirm = () => {
        if (selectedLocation) {
            onSelect({
                lat: selectedLocation.lat,
                lng: selectedLocation.lng,
                radius: zoneType === 'circle' ? radius : undefined,
                zoneType,
                address: address || searchQuery || undefined
            });
            onClose();
        } else {
            Alert.alert('Erreur', 'Veuillez sélectionner une localisation');
        }
    };

    const handleClearSelection = () => {
        setSelectedLocation(null);
        setSearchQuery('');
        setSearchResults([]);
        setAddress('');
    };

    const getZoneTypeIcon = (type: string) => {
        switch (type) {
            case 'point': return 'map-pin';
            case 'circle': return 'circle';
            case 'rectangle': return 'square';
            case 'polygon': return 'hexagon';
            default: return 'map-pin';
        }
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
                {/* Header avec gradient */}
                <LinearGradient
                    colors={modernColors.primaryGradient as unknown as readonly [string, string, ...string[]]}
                    style={styles.header}
                >
                    <View style={styles.headerContent}>
                        <View style={styles.headerLeft}>
                            <SafeIcon name="map-pin" size={24} color="#fff" />
                            <Text style={styles.headerTitle}>{title}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                        >
                            <SafeIcon name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <View style={styles.content}>
                    {/* Panel Gauche - Contrôles */}
                    <View style={styles.leftPanel}>
                        {/* Instructions */}
                        <NativeCard style={styles.instructionsCard}>
                            <View style={styles.instructionsHeader}>
                                <SafeIcon name="check" size={16} color={modernColors.success} />
                                <Text style={styles.instructionsTitle}>Instructions</Text>
                            </View>
                            <View style={styles.instructionsList}>
                                <Text style={styles.instructionItem}>• Recherchez une adresse dans la barre de recherche</Text>
                                <Text style={styles.instructionItem}>• Utilisez "Ma Position" pour votre GPS actuel</Text>
                                <Text style={styles.instructionItem}>• Saisissez des coordonnées manuellement</Text>
                                <Text style={styles.instructionItem}>• Choisissez le type de zone souhaité</Text>
                            </View>
                        </NativeCard>

                        {/* Bouton Ma Position GPS */}
                        <NativeButton
                            title="Ma Position GPS"
                            onPress={getCurrentLocation}
                            disabled={loading || !permissionGranted}
                            {...({ variant: "primary", size: "large", icon: "navigation" } as any)}
                            style={styles.gpsButton}
                        />

                        {/* Barre de recherche d'adresse */}
                        <View style={styles.searchSection}>
                            <NativeInput
                                placeholder="Rechercher une adresse..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                {...({ icon: "search" } as any)}
                                style={styles.searchInput}
                            />
                            <NativeButton
                                title="OK"
                                onPress={handleSearchAddress}
                                disabled={loading || !searchQuery.trim()}
                                variant="primary"
                                size="small"
                                style={styles.searchButton}
                            />
                        </View>

                        {/* Saisie coordonnées manuelles */}
                        <View style={styles.manualSection}>
                            <Text style={styles.sectionTitle}>✏️ Coordonnées manuelles</Text>
                            <View style={styles.manualInputContainer}>
                                <TextInput
                                    style={styles.coordinateInput}
                                    placeholder="latitude, longitude (ex: 4.031716, 9.817201)"
                                    value={searchQuery.includes(',') ? searchQuery : ''}
                                    onChangeText={(text) => {
                                        if (text.includes(',')) {
                                            setSearchQuery(text);
                                        }
                                    }}
                                    keyboardType="numeric"
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    style={styles.searchButton}
                                    onPress={handleManualCoordinates}
                                >
                                    <SafeIcon name="search" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Statut de sélection */}
                        <NativeCard style={[styles.statusCard, selectedLocation && styles.statusCardActive]}>
                            <View style={styles.statusHeader}>
                                <SafeIcon
                                    name={selectedLocation ? "check" : "alert-triangle"}
                                    size={16}
                                    color={selectedLocation ? modernColors.success : modernColors.warning}
                                />
                                <Text style={styles.statusTitle}>
                                    {selectedLocation ? 'Position sélectionnée' : 'Aucune position sélectionnée'}
                                </Text>
                            </View>

                            {selectedLocation ? (
                                <View style={styles.selectedLocationInfo}>
                                    <Text style={styles.coordinatesText}>
                                        {formatCoordinates(selectedLocation.lat, selectedLocation.lng)}
                                    </Text>
                                    {address && (
                                        <Text style={styles.addressText}>{address}</Text>
                                    )}
                                </View>
                            ) : (
                                <Text style={styles.noSelectionText}>
                                    Utilisez la recherche ou votre position GPS
                                </Text>
                            )}
                        </NativeCard>

                        {/* Modes de sélection */}
                        <NativeCard style={styles.modesCard}>
                            <Text style={styles.modesTitle}>Mode de sélection</Text>
                            <View style={styles.modesContainer}>
                                {[
                                    { key: 'point', label: 'Point', icon: 'map-pin' },
                                    { key: 'circle', label: 'Cercle', icon: 'circle' },
                                    { key: 'rectangle', label: 'Rectangle', icon: 'square' },
                                    { key: 'polygon', label: 'Polygone', icon: 'hexagon' }
                                ].map((mode) => (
                                    <TouchableOpacity
                                        key={mode.key}
                                        style={[
                                            styles.modeButton,
                                            zoneType === mode.key && styles.modeButtonActive
                                        ]}
                                        onPress={() => setZoneType(mode.key as any)}
                                    >
                                        <SafeIcon
                                            name={mode.icon}
                                            size={16}
                                            color={zoneType === mode.key ? '#FFFFFF' : modernColors.textSecondary}
                                        />
                                        <Text style={[
                                            styles.modeButtonText,
                                            zoneType === mode.key && styles.modeButtonTextActive
                                        ]}>
                                            {mode.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </NativeCard>

                        {/* Contrôles de rayon (pour cercle) */}
                        {zoneType === 'circle' && (
                            <NativeCard style={styles.radiusCard}>
                                <Text style={styles.radiusTitle}>Rayon (mètres)</Text>
                                <View style={styles.radiusControls}>
                                    <TouchableOpacity
                                        style={styles.radiusButton}
                                        onPress={() => setRadius(Math.max(10, radius - 10))}
                                    >
                                        <SafeIcon name="minus" size={16} color={modernColors.primary} />
                                    </TouchableOpacity>
                                    <Text style={styles.radiusValue}>{radius}m</Text>
                                    <TouchableOpacity
                                        style={styles.radiusButton}
                                        onPress={() => setRadius(Math.min(1000, radius + 10))}
                                    >
                                        <SafeIcon name="plus" size={16} color={modernColors.primary} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.radiusPresets}>
                                    {[50, 100, 200, 500, 1000].map((preset) => (
                                        <TouchableOpacity
                                            key={preset}
                                            style={[
                                                styles.radiusPreset,
                                                radius === preset && styles.radiusPresetActive
                                            ]}
                                            onPress={() => setRadius(preset)}
                                        >
                                            <Text style={[
                                                styles.radiusPresetText,
                                                radius === preset && styles.radiusPresetTextActive
                                            ]}>
                                                {preset}m
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </NativeCard>
                        )}

                        {/* Sélecteur de style de carte */}
                        <NativeCard style={styles.mapStyleCard}>
                            <Text style={styles.mapStyleTitle}>Style de carte</Text>
                            <View style={styles.mapStyleContainer}>
                                {[
                                    { key: 'standard', label: 'Standard', icon: 'map' },
                                    { key: 'satellite', label: 'Satellite', icon: 'globe' },
                                    { key: 'hybrid', label: 'Hybride', icon: 'layers' }
                                ].map((style) => (
                                    <TouchableOpacity
                                        key={style.key}
                                        style={[
                                            styles.mapStyleButton,
                                            mapStyle === style.key && styles.mapStyleButtonActive
                                        ]}
                                        onPress={() => setMapStyle(style.key as any)}
                                    >
                                        <SafeIcon
                                            name={style.icon}
                                            size={14}
                                            color={mapStyle === style.key ? '#FFFFFF' : modernColors.textSecondary}
                                        />
                                        <Text style={[
                                            styles.mapStyleButtonText,
                                            mapStyle === style.key && styles.mapStyleButtonTextActive
                                        ]}>
                                            {style.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </NativeCard>

                        {/* Boutons d'action */}
                        <View style={styles.actionsContainer}>
                            <NativeButton
                                title="Effacer"
                                onPress={handleClearSelection}
                                {...({ variant: "outline", size: "medium", icon: "trash-2" } as any)}
                                style={styles.clearButton}
                            />
                            <NativeButton
                                title="Confirmer"
                                onPress={handleConfirm}
                                disabled={!selectedLocation}
                                {...({ variant: "primary", size: "medium", icon: "check" } as any)}
                                style={styles.confirmButton}
                            />
                        </View>
                    </View>

                    {/* Panel Droit - Zone de visualisation (sans carte interactive) */}
                    <View style={styles.rightPanel}>
                        <NativeCard style={styles.mapCard}>
                            <View style={styles.mapPlaceholder}>
                                <SafeIcon name="map" size={64} color={modernColors.textSecondary} />
                                <Text style={styles.mapPlaceholderTitle}>Zone de sélection</Text>
                                <Text style={styles.mapPlaceholderText}>
                                    {selectedLocation
                                        ? `Position: ${formatCoordinates(selectedLocation.lat, selectedLocation.lng)}`
                                        : 'Aucune position sélectionnée'
                                    }
                                </Text>
                                {zoneType === 'circle' && selectedLocation && (
                                    <Text style={styles.radiusInfo}>Rayon: {radius}m</Text>
                                )}
                                {address && (
                                    <Text style={styles.addressInfo}>📍 {address}</Text>
                                )}
                            </View>
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
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    leftPanel: {
        flex: 1,
        padding: 16,
        gap: 16,
    },
    rightPanel: {
        flex: 1,
        padding: 16,
    },
    instructionsCard: {
        backgroundColor: '#f8fafc',
        borderColor: modernColors.primary,
        borderWidth: 1,
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
        gap: 4,
    },
    instructionItem: {
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
    gpsButton: {
        marginBottom: 8,
    },
    searchSection: {
        flexDirection: 'row',
        gap: 8,
    },
    searchInput: {
        flex: 1,
    },
    searchButton: {
        minWidth: 60,
    },
    manualSection: {
        gap: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    manualInputContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    coordinateInput: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    statusCard: {
        backgroundColor: '#fef3c7',
        borderColor: modernColors.warning,
    },
    statusCardActive: {
        backgroundColor: '#f0fdf4',
        borderColor: modernColors.success,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    statusTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    selectedLocationInfo: {
        gap: 4,
    },
    coordinatesText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        fontFamily: 'monospace',
    },
    addressText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    noSelectionText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    modesCard: {
        backgroundColor: '#f8fafc',
    },
    modesTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 12,
    },
    modesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    modeButton: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: modernColors.border,
        minWidth: 80,
    },
    modeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    modeButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    modeButtonTextActive: {
        color: '#fff',
    },
    radiusCard: {
        backgroundColor: '#f8fafc',
    },
    radiusTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 12,
    },
    radiusControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 12,
    },
    radiusButton: {
        backgroundColor: '#fff',
        borderRadius: 20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    radiusValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.primary,
        minWidth: 60,
        textAlign: 'center',
    },
    radiusPresets: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    radiusPreset: {
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    radiusPresetActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    radiusPresetText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    radiusPresetTextActive: {
        color: '#fff',
    },
    mapStyleCard: {
        backgroundColor: '#f8fafc',
    },
    mapStyleTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 12,
    },
    mapStyleContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    mapStyleButton: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: modernColors.border,
        flex: 1,
    },
    mapStyleButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    mapStyleButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    mapStyleButtonTextActive: {
        color: '#fff',
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
    },
    mapPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 32,
        gap: 16,
    },
    mapPlaceholderTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    mapPlaceholderText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    radiusInfo: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    addressInfo: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default AdvancedGPSModal;



