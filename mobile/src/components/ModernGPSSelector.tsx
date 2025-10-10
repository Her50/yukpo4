import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
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
import InteractiveMapView from './InteractiveMapView';
import { NativeButton, NativeCard, NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showMap, setShowMap] = useState(false);
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

    const handleConfirmSelection = () => {
        if (selectedLocation) {
            onSelect({
                lat: selectedLocation.lat,
                lng: selectedLocation.lng,
                radius: zoneType === 'circle' ? radius : undefined,
                zoneType: zoneType,
                address: searchQuery || undefined
            });
            onClose();
        } else {
            Alert.alert('Erreur', 'Veuillez sélectionner une position');
        }
    };

    const handleClearSelection = () => {
        setSelectedLocation(null);
        setSearchQuery('');
        setSearchResults([]);
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
                    {/* Panel Gauche - Instructions et Contrôles */}
                    <View style={styles.leftPanel}>
                        {/* Instructions */}
                        <NativeCard style={styles.instructionsCard}>
                            <View style={styles.instructionsHeader}>
                                <SafeIcon name="check" size={16} color={modernColors.success} />
                                <SafeIcon name="file-text" size={16} color={modernColors.primary} />
                                <Text style={styles.instructionsTitle}>Instructions</Text>
                            </View>
                            <View style={styles.instructionsList}>
                                <Text style={styles.instructionItem}>• Cliquez sur la carte pour sélectionner un point</Text>
                                <Text style={styles.instructionItem}>• Dessinez une zone avec l'outil polygone (icône crayon)</Text>
                                <Text style={styles.instructionItem}>• Recherchez une adresse dans la barre de recherche</Text>
                                <Text style={styles.instructionItem}>• Utilisez "Ma Position" pour votre GPS actuel</Text>
                            </View>
                        </NativeCard>

                        {/* Bouton Ma Position GPS */}
                        <NativeButton
                            title="Ma Position GPS"
                            onPress={getCurrentLocation}
                            disabled={loading || !permissionGranted}
                            variant="primary"
                            size="large"
                            style={styles.gpsButton}
                            icon="target"
                        />

                        {/* Barre de recherche */}
                        <View style={styles.searchSection}>
                            <NativeInput
                                placeholder="Rechercher une adresse..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={styles.searchInput}
                                icon="search"
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

                        {/* Statut de sélection */}
                        <NativeCard style={styles.statusCard}>
                            <View style={styles.statusHeader}>
                                <SafeIcon
                                    name={selectedLocation ? "check" : "alert-triangle"}
                                    size={16}
                                    color={selectedLocation ? modernColors.success : modernColors.warning}
                                />
                                <SafeIcon name="map-pin" size={16} color={modernColors.error} />
                                <Text style={styles.statusTitle}>
                                    {selectedLocation ? 'Position sélectionnée' : 'Aucune position sélectionnée'}
                                </Text>
                            </View>

                            {selectedLocation ? (
                                <View style={styles.selectedLocationInfo}>
                                    <Text style={styles.coordinatesText}>
                                        {formatCoordinates(selectedLocation.lat, selectedLocation.lng)}
                                    </Text>
                                    {searchQuery && (
                                        <Text style={styles.addressText}>{searchQuery}</Text>
                                    )}
                                </View>
                            ) : (
                                <Text style={styles.noSelectionText}>
                                    Cliquez sur la carte ou utilisez la recherche pour sélectionner une position
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
                                    { key: 'polygon', label: 'Polygone', icon: 'edit' }
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
                                variant="outline"
                                size="medium"
                                style={styles.clearButton}
                                icon="trash-2"
                            />
                            <NativeButton
                                title="Confirmer"
                                onPress={handleConfirmSelection}
                                disabled={!selectedLocation}
                                variant="primary"
                                size="medium"
                                style={styles.confirmButton}
                                icon="check"
                            />
                        </View>
                    </View>

                    {/* Panel Droit - Carte Interactive */}
                    <View style={styles.rightPanel}>
                        <NativeCard style={styles.mapCard}>
                            <InteractiveMapView
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
        flexDirection: 'row',
    },
    leftPanel: {
        width: width * 0.4,
        padding: 16,
        gap: 16,
    },
    rightPanel: {
        flex: 1,
        padding: 16,
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
