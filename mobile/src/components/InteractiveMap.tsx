import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../theme/theme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface InteractiveMapProps {
    initialLocation?: { latitude: number; longitude: number };
    onLocationSelect: (location: { latitude: number; longitude: number; radius: number; zoneType?: 'point' | 'circle' | 'rectangle' }) => void;
    onClose: () => void;
    showRadiusSelector?: boolean;
    initialRadius?: number;
    allowZoneSelection?: boolean;
}

const { width, height } = Dimensions.get('window');

const InteractiveMap: React.FC<InteractiveMapProps> = ({
    initialLocation,
    onLocationSelect,
    onClose,
    showRadiusSelector = true,
    initialRadius = 50,
    allowZoneSelection = true
}) => {
        const { t } = useLanguageSafe();
const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(
        initialLocation ? { latitude: initialLocation.latitude, longitude: initialLocation.longitude } : null
    );
    const [radius, setRadius] = useState(initialRadius);
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [zoneType, setZoneType] = useState<'point' | 'circle' | 'rectangle'>('circle');
    const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid' | '3d'>('3d');
    const [showBuildings, setShowBuildings] = useState(true);
    const [showStreets, setShowStreets] = useState(true);
    const [mapCenter, setMapCenter] = useState({ x: width / 2, y: height / 2 });

    // Obtenir la position actuelle
    const getCurrentLocation = async () => {
        try {
            setLoading(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('interactiveMap.permissionRefusee'), t('interactiveMap.permissionDeLocalisationRefusee'));
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const newLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            setCurrentLocation(newLocation);
            setSelectedLocation(newLocation);
        } catch (error) {
            console.error('Erreur GPS:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
        } finally {
            setLoading(false);
        }
    };

    // Gérer la sélection tactile sur la carte
    const handleMapPress = (event: any) => {
        const { locationX, locationY } = event.nativeEvent;
        setMapCenter({ x: locationX, y: locationY });

        // Simuler des coordonnées GPS basées sur la position touchée
        // Pour une vraie implémentation, il faudrait convertir les coordonnées d'écran en coordonnées GPS
        const simulatedLat = 4.031716 + (locationY - height / 2) * 0.0001;
        const simulatedLng = 9.817201 + (locationX - width / 2) * 0.0001;

        const newLocation = {
            latitude: simulatedLat,
            longitude: simulatedLng,
        };

        setSelectedLocation(newLocation);
        console.log('📍 Position sélectionnée:', newLocation);
    };

    // Confirmer la sélection
    const handleConfirmSelection = () => {
        if (selectedLocation) {
            onLocationSelect({
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                radius: radius,
                zoneType: zoneType
            });
            onClose();
        } else {
            Alert.alert('Erreur', t('interactiveMap.veuillezSelectionnerUnEmplacementSurLa'));
        }
    };

    // Obtenir la position actuelle au chargement
    useEffect(() => {
        getCurrentLocation();
    }, []);

    return (
        <GestureHandlerRootView style={styles.container}>
            {/* Header moderne */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('interactiveMap.carte3dInteractive')}</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.mapStyleButton, mapStyle === '3d' && styles.mapStyleButtonActive]}
                        onPress={() => setMapStyle('3d')}
                    >
                        <Text style={styles.mapStyleIcon}>🏗️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mapStyleButton, mapStyle === 'satellite' && styles.mapStyleButtonActive]}
                        onPress={() => setMapStyle('satellite')}
                    >
                        <Text style={styles.mapStyleIcon}>🛰️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Zone de carte 3D simulée */}
            <View style={styles.mapContainer}>
                <TouchableOpacity
                    style={styles.map3D}
                    onPress={handleMapPress}
                    activeOpacity={0.9}
                >
                    {/* Simulation d'une carte 3D avec bâtiments */}
                    <View style={styles.buildingsContainer}>
                        {showBuildings && (
                            <>
                                <View style={[styles.building, styles.building1]} />
                                <View style={[styles.building, styles.building2]} />
                                <View style={[styles.building, styles.building3]} />
                                <View style={[styles.building, styles.building4]} />
                                <View style={[styles.building, styles.building5]} />
                            </>
                        )}
                    </View>

                    {/* Rues et routes */}
                    {showStreets && (
                        <View style={styles.streetsContainer}>
                            <View style={[styles.street, styles.streetHorizontal]} />
                            <View style={[styles.street, styles.streetVertical]} />
                            <View style={[styles.street, styles.streetDiagonal]} />
                        </View>
                    )}

                    {/* Zone de sélection */}
                    {selectedLocation && (
                        <View style={[styles.selectionZone, {
                            left: mapCenter.x - (zoneType === 'circle' ? radius : radius * 0.75),
                            top: mapCenter.y - (zoneType === 'circle' ? radius : radius * 0.6)
                        }]}>
                            {zoneType === 'circle' && (
                                <View style={[styles.circleZone, { width: radius * 2, height: radius * 2 }]} />
                            )}
                            {zoneType === 'rectangle' && (
                                <View style={[styles.rectangleZone, { width: radius * 1.5, height: radius * 1.2 }]} />
                            )}
                            {zoneType === 'point' && (
                                <View style={styles.pointMarker} />
                            )}
                        </View>
                    )}

                    {/* Marqueur de position */}
                    {selectedLocation && (
                        <View style={[styles.positionMarker, {
                            left: mapCenter.x - 15,
                            top: mapCenter.y - 30
                        }]}>
                            <Text style={styles.markerIcon}>📍</Text>
                        </View>
                    )}

                    {/* Indicateur d'interactivité */}
                    {!selectedLocation && (
                        <View style={styles.interactiveIndicator}>
                            <Text style={styles.interactiveText}>{t('interactiveMap.touchezPourSelectionner')}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Contrôles de la carte */}
                <View style={styles.mapControls}>
                    <TouchableOpacity
                        style={[styles.controlButton, showBuildings && styles.controlButtonActive]}
                        onPress={() => setShowBuildings(!showBuildings)}
                    >
                        <Text style={styles.controlIcon}>🏢</Text>
                        <Text style={styles.controlText}>{t('interactiveMap.batiments')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlButton, showStreets && styles.controlButtonActive]}
                        onPress={() => setShowStreets(!showStreets)}
                    >
                        <Text style={styles.controlIcon}>🛣️</Text>
                        <Text style={styles.controlText}>Rues</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Sélecteur de type de zone */}
            {allowZoneSelection && (
                <View style={styles.zoneTypeSelector}>
                    <Text style={styles.zoneTypeLabel}>{t('interactiveMap.typeDeZone')}</Text>
                    <View style={styles.zoneTypeButtons}>
                        {[
                            { type: 'point', icon: '📍', label: 'Point' },
                            { type: 'circle', icon: '⭕', label: 'Cercle' },
                            { type: 'rectangle', icon: '⬜', label: 'Rectangle' }
                        ].map(({ type, icon, label }) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.zoneTypeButton, zoneType === type && styles.zoneTypeButtonActive]}
                                onPress={() => setZoneType(type as any)}
                            >
                                <Text style={styles.zoneTypeIcon}>{icon}</Text>
                                <Text style={[styles.zoneTypeText, zoneType === type && styles.zoneTypeTextActive]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Informations de position */}
            <View style={styles.positionInfo}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={styles.loadingText}>Obtention de votre position...</Text>
                    </View>
                ) : selectedLocation ? (
                    <View style={styles.locationInfo}>
                        <Text style={styles.locationLabel}>{t('interactiveMap.positionSelectionnee')}</Text>
                        <Text style={styles.locationCoords}>
                            Lat: {selectedLocation.latitude.toFixed(6)}
                        </Text>
                        <Text style={styles.locationCoords}>
                            Lng: {selectedLocation.longitude.toFixed(6)}
                        </Text>
                        <Text style={styles.zoneInfo}>
                            Zone: {zoneType} - Rayon: {radius} km
                        </Text>
                    </View>
                ) : (
                    <View style={styles.helpContainer}>
                        <Text style={styles.helpText}>
                            👆 Touchez la carte pour sélectionner un emplacement
                        </Text>
                        <Text style={styles.helpSubtext}>
                            Ou appuyez sur "Actualiser position" pour utiliser votre position actuelle
                        </Text>
                    </View>
                )}
            </View>

            {/* Contrôles en bas */}
            <View style={styles.bottomControls}>
                {showRadiusSelector && (
                    <View style={styles.radiusControl}>
                        <Text style={styles.radiusLabel}>Rayon: {radius} km</Text>
                        <View style={styles.radiusButtons}>
                            {[1, 5, 10, 25, 50, 100].map((value) => (
                                <TouchableOpacity
                                    key={value}
                                    style={[styles.radiusButton, radius === value && styles.radiusButtonActive]}
                                    onPress={() => setRadius(value)}
                                >
                                    <Text style={[styles.radiusButtonText, radius === value && styles.radiusButtonTextActive]}>
                                        {value}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.useCurrentButton}
                        onPress={getCurrentLocation}
                        disabled={loading}
                    >
                        <Text style={styles.useCurrentButtonText}>
                            {loading ? '⏳ Chargement...' : '📍 Actualiser position'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.confirmButton, !selectedLocation && styles.confirmButtonDisabled]}
                        onPress={handleConfirmSelection}
                        disabled={!selectedLocation}
                    >
                        <Text style={styles.confirmButtonText}>{t('interactiveMap.confirmerZone')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    closeButton: {
        padding: 8,
    },
    closeIcon: {
        fontSize: 24,
        color: theme.colors.text,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    mapStyleButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
    mapStyleButtonActive: {
        backgroundColor: theme.colors.primary,
    },
    mapStyleIcon: {
        fontSize: 20,
    },
    mapContainer: {
        flex: 1,
        margin: 16,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#e8f4f8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    map3D: {
        flex: 1,
        position: 'relative',
        backgroundColor: '#87CEEB',
    },
    buildingsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    building: {
        position: 'absolute',
        backgroundColor: '#2c3e50',
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    building1: {
        width: 40,
        height: 80,
        top: 50,
        left: 50,
        borderRadius: 4,
    },
    building2: {
        width: 35,
        height: 120,
        top: 30,
        left: 120,
        borderRadius: 4,
    },
    building3: {
        width: 45,
        height: 100,
        top: 40,
        left: 200,
        borderRadius: 4,
    },
    building4: {
        width: 30,
        height: 90,
        top: 60,
        left: 280,
        borderRadius: 4,
    },
    building5: {
        width: 50,
        height: 110,
        top: 20,
        left: 350,
        borderRadius: 4,
    },
    streetsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    street: {
        position: 'absolute',
        backgroundColor: '#34495e',
    },
    streetHorizontal: {
        width: '100%',
        height: 8,
        top: '50%',
        left: 0,
    },
    streetVertical: {
        width: 8,
        height: '100%',
        left: '50%',
        top: 0,
    },
    streetDiagonal: {
        width: 200,
        height: 6,
        top: '30%',
        left: '20%',
        transform: [{ rotate: '45deg' }],
    },
    selectionZone: {
        position: 'absolute',
    },
    circleZone: {
        borderRadius: 50,
        borderWidth: 3,
        borderColor: theme.colors.primary,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
    },
    rectangleZone: {
        borderWidth: 3,
        borderColor: theme.colors.primary,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderRadius: 8,
    },
    pointMarker: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: theme.colors.primary,
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    positionMarker: {
        position: 'absolute',
    },
    markerIcon: {
        fontSize: 30,
    },
    interactiveIndicator: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -80 }, { translateY: -15 }],
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    interactiveText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.primary,
        textAlign: 'center',
    },
    mapControls: {
        position: 'absolute',
        top: 16,
        right: 16,
        flexDirection: 'column',
        gap: 8,
    },
    controlButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    controlButtonActive: {
        backgroundColor: theme.colors.primary,
    },
    controlIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    controlText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text,
    },
    zoneTypeSelector: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    zoneTypeLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    zoneTypeButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    zoneTypeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    zoneTypeButtonActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    zoneTypeIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    zoneTypeText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    zoneTypeTextActive: {
        color: 'white',
    },
    positionInfo: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    loadingText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginTop: 8,
    },
    locationInfo: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary,
    },
    locationLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    locationCoords: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontFamily: 'monospace',
        marginVertical: 2,
    },
    zoneInfo: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.primary,
        marginTop: 8,
    },
    helpContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    helpText: {
        fontSize: 16,
        color: theme.colors.primary,
        textAlign: 'center',
        fontWeight: '600',
        marginBottom: 8,
    },
    helpSubtext: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    bottomControls: {
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    radiusControl: {
        marginBottom: 16,
    },
    radiusLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    radiusButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: 8,
    },
    radiusButton: {
        backgroundColor: '#f8f9fa',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        minWidth: 50,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    radiusButtonActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    radiusButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    radiusButtonTextActive: {
        color: 'white',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    useCurrentButton: {
        flex: 1,
        backgroundColor: '#4CAF50',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    useCurrentButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: theme.colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    confirmButtonDisabled: {
        backgroundColor: '#ccc',
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default InteractiveMap;




