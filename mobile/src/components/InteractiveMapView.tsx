import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Circle, Marker, Polygon, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width, height } = Dimensions.get('window');

interface InteractiveMapViewProps {
    selectedLocation?: { lat: number; lng: number } | null;
    onLocationSelect?: (location: { lat: number; lng: number }) => void;
    onPolygonSelect?: (polygon: { lat: number; lng: number }[]) => void;
    zoneType: 'point' | 'circle' | 'rectangle' | 'polygon';
    radius?: number;
    mapStyle?: 'standard' | 'satellite' | 'hybrid';
    showBuildings?: boolean;
    showTraffic?: boolean;
    polygonPoints?: { lat: number; lng: number }[];
    onPolygonPointsChange?: (points: { lat: number; lng: number }[]) => void;
    initialRegion?: Region; // ✅ NOUVEAU: Permettre de définir la région initiale
}

export interface InteractiveMapViewRef {
    animateToRegion: (region: Region, duration?: number) => void;
}

const InteractiveMapView = forwardRef<InteractiveMapViewRef, InteractiveMapViewProps>(({
    selectedLocation,
    onLocationSelect,
    onPolygonSelect,
    zoneType,
    radius = 50,
    mapStyle = 'satellite',
    showBuildings = true,
    showTraffic = true,
    polygonPoints = [],
    onPolygonPointsChange,
    initialRegion, // ✅ NOUVEAU: Région initiale pour centrer la carte
}, ref) => {
    const mapRef = useRef<MapView>(null);
    const [localPolygonPoints, setLocalPolygonPoints] = useState<{ lat: number; lng: number }[]>(polygonPoints);
    const [mapRegion, setMapRegion] = useState(() => {
        // ✅ NOUVEAU: Utiliser initialRegion en priorité, puis selectedLocation, puis défaut
        if (initialRegion) {
            return initialRegion;
        }
        if (selectedLocation?.lat && selectedLocation?.lng) {
            return {
                latitude: selectedLocation.lat,
                longitude: selectedLocation.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
        }
        return {
            latitude: 4.031716, // Douala, Cameroun par défaut
            longitude: 9.817201,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        };
    });
    const [mapReady, setMapReady] = useState(false);
    const [mapError, setMapError] = useState(false);
    // ✅ NOUVEAU: Animation pour l'indicateur de déplacement
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // ✅ NOUVEAU: Exposer la méthode animateToRegion via ref
    useImperativeHandle(ref, () => ({
        animateToRegion: (region: Region, duration: number = 500) => {
            mapRef.current?.animateToRegion(region, duration);
        },
    }), []);

    // ✅ CORRIGÉ 2026-01-23: Repositionner automatiquement la carte avec animation fluide et visible
    const [isAnimating, setIsAnimating] = useState(false);
    const previousLocationRef = useRef<{ lat: number; lng: number } | null>(null);
    
    useEffect(() => {
        if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
            // Vérifier si c'est un nouveau lieu (pas juste une mise à jour initiale)
            const isNewLocation = previousLocationRef.current === null || 
                previousLocationRef.current.lat !== selectedLocation.lat || 
                previousLocationRef.current.lng !== selectedLocation.lng;
            
            if (isNewLocation && mapReady && mapRef.current) {
                const newRegion: Region = {
                    latitude: selectedLocation.lat,
                    longitude: selectedLocation.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                };
                
                // ✅ AMÉLIORÉ: Activer l'indicateur d'animation
                setIsAnimating(true);
                
                // ✅ NOUVEAU: Démarrer l'animation de pulse
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.3,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
                
                // ✅ AMÉLIORÉ: Animation plus longue et fluide (1000ms au lieu de 500ms)
                mapRef.current.animateToRegion(newRegion, 1000);
                
                // ✅ AMÉLIORÉ: Désactiver l'indicateur après l'animation
                setTimeout(() => {
                    setIsAnimating(false);
                    pulseAnim.stopAnimation();
                    pulseAnim.setValue(1);
                }, 1000);
                
                // Mettre à jour la référence de la position précédente
                previousLocationRef.current = { lat: selectedLocation.lat, lng: selectedLocation.lng };
            }
            
            // Mettre à jour mapRegion pour que la carte se repositionne
            setMapRegion({
                latitude: selectedLocation.lat,
                longitude: selectedLocation.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
        }
    }, [selectedLocation, mapReady]);

    // ✅ CORRECTION CRASH: Timeout pour le chargement de la carte
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!mapReady) {
                console.warn('[InteractiveMapView] ⚠️ Map loading timeout');
                setMapReady(true); // Forcer l'affichage même si pas prêt
            }
        }, 5000);

        return () => clearTimeout(timeout);
    }, [mapReady]);

    const handleMapPress = (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        const newPoint = { lat: latitude, lng: longitude };

        if (zoneType === 'polygon') {
            // Mode polygone : ajouter un point au polygone
            const newPoints = [...localPolygonPoints, newPoint];
            setLocalPolygonPoints(newPoints);
            if (onPolygonPointsChange) {
                onPolygonPointsChange(newPoints);
            }
            if (newPoints.length >= 3 && onPolygonSelect) {
                onPolygonSelect(newPoints);
            }
        } else if (onLocationSelect) {
            // ✅ AMÉLIORÉ: Mode point avec animation visible
            // Activer l'indicateur d'animation avant de changer la position
            setIsAnimating(true);
            
            // ✅ NOUVEAU: Démarrer l'animation de pulse
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.3,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
            
            // Appeler onLocationSelect qui déclenchera l'animation via useEffect
            onLocationSelect(newPoint);
            
            // ✅ NOUVEAU: Animer immédiatement la carte vers le nouveau point pour feedback instantané
            if (mapRef.current) {
                const newRegion: Region = {
                    latitude: newPoint.lat,
                    longitude: newPoint.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                };
                // Animation fluide de 1000ms pour que l'utilisateur voie le déplacement
                mapRef.current.animateToRegion(newRegion, 1000);
            }
            
            // Désactiver l'indicateur après l'animation
            setTimeout(() => {
                setIsAnimating(false);
                pulseAnim.stopAnimation();
                pulseAnim.setValue(1);
            }, 1000);
        }
    };

    const getMapType = () => {
        switch (mapStyle) {
            case 'satellite':
                return 'satellite';
            case 'hybrid':
                return 'hybrid';
            default:
                return 'standard';
        }
    };

    const renderZoneOverlay = () => {
        switch (zoneType) {
            case 'circle':
                if (!selectedLocation) return null;
                return (
                    <Circle
                        center={{
                            latitude: selectedLocation.lat,
                            longitude: selectedLocation.lng,
                        }}
                        radius={radius}
                        strokeColor={modernColors.primary}
                        fillColor={`${modernColors.primary}20`}
                        strokeWidth={2}
                    />
                );
            case 'rectangle':
                if (!selectedLocation) return null;
                // Rectangle simple autour du point
                const delta = radius / 111000; // Conversion approximative mètres -> degrés
                return (
                    <Polygon
                        coordinates={[
                            {
                                latitude: selectedLocation.lat - delta,
                                longitude: selectedLocation.lng - delta,
                            },
                            {
                                latitude: selectedLocation.lat + delta,
                                longitude: selectedLocation.lng - delta,
                            },
                            {
                                latitude: selectedLocation.lat + delta,
                                longitude: selectedLocation.lng + delta,
                            },
                            {
                                latitude: selectedLocation.lat - delta,
                                longitude: selectedLocation.lng + delta,
                            },
                        ]}
                        strokeColor={modernColors.primary}
                        fillColor={`${modernColors.primary}20`}
                        strokeWidth={2}
                    />
                );
            case 'polygon':
                // Afficher le polygone en cours de dessin
                if (localPolygonPoints.length >= 3) {
                    return (
                        <Polygon
                            coordinates={localPolygonPoints.map(p => ({
                                latitude: p.lat,
                                longitude: p.lng,
                            }))}
                            strokeColor={modernColors.success}
                            fillColor={`${modernColors.success}30`}
                            strokeWidth={2}
                            tappable={true}
                        />
                    );
                }
                return null;
            default:
                return null;
        }
    };

    const clearPolygon = () => {
        setLocalPolygonPoints([]);
        if (onPolygonPointsChange) {
            onPolygonPointsChange([]);
        }
    };

    return (
        <View style={styles.container}>
            {!mapReady && !mapError && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement de la carte...</Text>
                </View>
            )}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                mapType={getMapType()}
                region={mapRegion}
                onPress={handleMapPress}
                onMapReady={() => {
                    console.log('[InteractiveMapView] ✅ Map ready');
                    setMapReady(true);
                    setMapError(false);
                }}
                onError={(error) => {
                    console.error('[InteractiveMapView] ❌ Map error:', error);
                    setMapError(true);
                    setMapReady(true);
                }}
                showsUserLocation={true}
                showsMyLocationButton={true}
                showsBuildings={showBuildings}
                showsTraffic={showTraffic}
                showsIndoors={true}
                showsPointsOfInterest={true}
                showsCompass={true}
                showsScale={true}
                showsIndoorLevelPicker={true}
                loadingEnabled={true}
                loadingIndicatorColor={modernColors.primary}
                loadingBackgroundColor={modernColors.background}
                customMapStyle={mapStyle === 'standard' ? undefined : []}
            >
                {/* ✅ AMÉLIORÉ: Marqueur de position sélectionnée avec animation de pulse */}
                {selectedLocation && zoneType !== 'polygon' && (
                    <Marker
                        coordinate={{
                            latitude: selectedLocation.lat,
                            longitude: selectedLocation.lng,
                        }}
                        title="Position sélectionnée"
                        description={`${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`}
                        pinColor={modernColors.primary}
                        // ✅ NOUVEAU: Animation du marqueur pour feedback visuel
                        tracksViewChanges={isAnimating}
                    />
                )}

                {/* Markers des points du polygone */}
                {zoneType === 'polygon' && localPolygonPoints.map((point, index) => (
                    <Marker
                        key={`polygon-point-${index}`}
                        coordinate={{
                            latitude: point.lat,
                            longitude: point.lng,
                        }}
                        title={`Point ${index + 1}`}
                        description={`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`}
                        pinColor={modernColors.success}
                    />
                ))}

                {/* Overlay de zone selon le type */}
                {renderZoneOverlay()}
            </MapView>

            {/* ✅ REFONTE: Indicateur de mode en haut à gauche */}
            <View style={styles.modeIndicatorLeft}>
                {/* Indicateur de mode - AMÉLIORÉ */}
                <View style={styles.modeIndicator}>
                    <SafeIcon
                        name={zoneType === 'point' ? "circle" : "maximize"}
                        size={14}
                        color={modernColors.primary}
                    />
                    <Text style={styles.modeText}>
                        {zoneType === 'point' ? 'Point précis' : `Zone (${localPolygonPoints.length} pts)`}
                    </Text>
                </View>
            </View>

            {/* Contrôles de carte à droite */}
            <View style={styles.mapControls}>

                {/* ✅ Contrôles de zoom avec labels */}
                <View style={styles.zoomControls}>
                    <TouchableOpacity
                        style={styles.zoomButton}
                        onPress={() => {
                            mapRef.current?.animateToRegion({
                                ...mapRegion,
                                latitudeDelta: mapRegion.latitudeDelta * 0.5,
                                longitudeDelta: mapRegion.longitudeDelta * 0.5,
                            });
                        }}
                    >
                        <SafeIcon name="plus" size={18} color={modernColors.text} />
                        <Text style={styles.zoomLabel}>Zoom +</Text>
                    </TouchableOpacity>

                    <View style={styles.zoomDivider} />

                    <TouchableOpacity
                        style={styles.zoomButton}
                        onPress={() => {
                            mapRef.current?.animateToRegion({
                                ...mapRegion,
                                latitudeDelta: mapRegion.latitudeDelta * 2,
                                longitudeDelta: mapRegion.longitudeDelta * 2,
                            });
                        }}
                    >
                        <SafeIcon name="minus" size={18} color={modernColors.text} />
                        <Text style={styles.zoomLabel}>Zoom -</Text>
                    </TouchableOpacity>
                </View>

                {/* Bouton centrer sur position - AMÉLIORÉ */}
                {selectedLocation && (
                    <TouchableOpacity
                        style={styles.centerButton}
                        onPress={() => {
                            mapRef.current?.animateToRegion({
                                latitude: selectedLocation.lat,
                                longitude: selectedLocation.lng,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            });
                        }}
                    >
                        <SafeIcon name="target" size={16} color="#FFFFFF" />
                        <Text style={styles.centerButtonText}>Centrer</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ✅ NOUVEAU: Indicateur visuel pendant l'animation de déplacement avec animation pulse */}
            {isAnimating && (
                <View style={styles.animationIndicator}>
                    <Animated.View 
                        style={[
                            styles.animationPulse,
                            {
                                transform: [{ scale: pulseAnim }],
                                opacity: pulseAnim.interpolate({
                                    inputRange: [0.5, 1],
                                    outputRange: [0.5, 1],
                                }),
                            }
                        ]} 
                    />
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.animationText}>Déplacement...</Text>
                </View>
            )}

            {/* Légende des informations */}
            <View style={styles.legend}>
                {zoneType === 'polygon' ? (
                    <>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: modernColors.success }]} />
                            <Text style={styles.legendText}>
                                Points: {localPolygonPoints.length}
                                {localPolygonPoints.length < 3 && ' (min. 3 pour une zone)'}
                            </Text>
                        </View>
                        {localPolygonPoints.length > 0 && (
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={clearPolygon}
                            >
                                <SafeIcon name="trash" size={14} color="#FFFFFF" />
                                <Text style={styles.clearButtonText}>Effacer</Text>
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    <>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: modernColors.primary }]} />
                            <Text style={styles.legendText}>Position sélectionnée</Text>
                        </View>
                        {zoneType === 'circle' && (
                            <View style={styles.legendItem}>
                                <View style={[styles.legendColor, { backgroundColor: `${modernColors.primary}20` }]} />
                                <Text style={styles.legendText}>Zone de service ({radius}m)</Text>
                            </View>
                        )}
                    </>
                )}
            </View>
        </View>
    );
});

InteractiveMapView.displayName = 'InteractiveMapView';

export default InteractiveMapView;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    map: {
        flex: 1,
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        zIndex: 1000,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    modeIndicatorLeft: {
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
    },
    mapControls: {
        position: 'absolute',
        top: 16,
        right: 16,
        gap: 8,
    },
    modeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    modeText: {
        fontSize: 12,
        color: modernColors.text,
        fontWeight: '500',
    },
    // ✅ NOUVEAU: Contrôles de zoom améliorés avec labels
    zoomControls: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 4,
    },
    zoomButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        minWidth: 90, // ✅ Largeur minimale pour le texte
    },
    zoomLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: modernColors.text,
        letterSpacing: 0.3,
    },
    zoomDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 2,
    },
    // ✅ NOUVEAU: Bouton centrer amélioré avec label
    centerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 10,
        shadowColor: modernColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    centerButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    legend: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 12,
        borderRadius: 8,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendColor: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendText: {
        fontSize: 12,
        color: modernColors.text,
        fontWeight: '500',
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.error,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        gap: 6,
        marginTop: 8,
    },
    clearButtonText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    // ✅ NOUVEAU: Styles pour l'indicateur d'animation
    animationIndicator: {
        position: 'absolute',
        top: '45%',
        alignSelf: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.95)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 10,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    animationPulse: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
    },
    animationText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
});
