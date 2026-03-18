import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Circle, Marker, Polygon, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    initialRegion,
}, ref) => {
    const mapRef = useRef<MapView>(null);
        const { t } = useLanguageSafe();
const [localPolygonPoints, setLocalPolygonPoints] = useState<{ lat: number; lng: number }[]>(polygonPoints);
    // ✅ CORRIGÉ 2026-02-25: Utiliser initialRegion UNIQUEMENT (non-contrôlé)
    // region={} contrôlé causait des sauts visuels à chaque setState
    const startRegion = initialRegion || (selectedLocation?.lat && selectedLocation?.lng ? {
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
    } : {
        latitude: 4.031716,
        longitude: 9.817201,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
    });
    // ✅ Garder une ref pour le zoom courant (mis à jour par onRegionChangeComplete)
    const currentRegionRef = useRef(startRegion);
    const [mapReady, setMapReady] = useState(false);

    // ✅ NOUVEAU: Exposer la méthode animateToRegion via ref
    useImperativeHandle(ref, () => ({
        animateToRegion: (region: Region, duration: number = 500) => {
            mapRef.current?.animateToRegion(region, duration);
        },
    }), []);

    // ✅ CORRIGÉ 2026-02-25: Animation fluide sans saut visuel
    const previousLocationRef = useRef<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null && mapReady && mapRef.current) {
            const isNewLocation = previousLocationRef.current === null ||
                previousLocationRef.current.lat !== selectedLocation.lat ||
                previousLocationRef.current.lng !== selectedLocation.lng;

            if (isNewLocation) {
                // ✅ CORRIGÉ: Garder le zoom actuel de l'utilisateur au lieu de forcer 0.01
                const currentDelta = currentRegionRef.current;
                const newRegion: Region = {
                    latitude: selectedLocation.lat,
                    longitude: selectedLocation.lng,
                    latitudeDelta: currentDelta.latitudeDelta,
                    longitudeDelta: currentDelta.longitudeDelta,
                };
                // Animation fluide de 800ms — pas de saut
                mapRef.current.animateToRegion(newRegion, 800);
                previousLocationRef.current = { lat: selectedLocation.lat, lng: selectedLocation.lng };
            }
        }
    }, [selectedLocation, mapReady]);

    // ✅ FIX 2026-03-11: Timeout court — forcer mapReady pour que l'animation vers selectedLocation puisse se déclencher
    // Plus d'overlay opaque, donc pas besoin d'attendre longtemps
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!mapReady) {
                console.warn('[InteractiveMapView] ⚠️ Map loading timeout — forçage mapReady');
                setMapReady(true);
            }
        }, 5000);

        return () => clearTimeout(timeout);
    }, [mapReady]);

    // ✅ FIX 2026-03-07: Log diagnostic au montage
    useEffect(() => {
        console.log('[InteractiveMapView] \uD83D\uDDFA️ Montage composant', {
            platform: Platform.OS,
            provider: Platform.OS === 'android' ? 'google (default)' : 'PROVIDER_GOOGLE',
            initialRegionSet: !!initialRegion,
            selectedLocation: selectedLocation ? `${selectedLocation.lat},${selectedLocation.lng}` : 'null',
            startRegion: `${startRegion.latitude.toFixed(4)},${startRegion.longitude.toFixed(4)}`,
        });
    }, []);

    const handleMapPress = (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        const newPoint = { lat: latitude, lng: longitude };

        if (zoneType === 'polygon') {
            const newPoints = [...localPolygonPoints, newPoint];
            setLocalPolygonPoints(newPoints);
            if (onPolygonPointsChange) {
                onPolygonPointsChange(newPoints);
            }
            if (newPoints.length >= 3 && onPolygonSelect) {
                onPolygonSelect(newPoints);
            }
        } else if (onLocationSelect) {
            // ✅ CORRIGÉ 2026-02-25: Juste notifier le parent — l'animation sera
            // déclenchée par le useEffect quand selectedLocation change.
            // PAS de double animateToRegion ici.
            onLocationSelect(newPoint);
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
        <View
            style={styles.container}
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                console.log(`[InteractiveMapView] \uD83D\uDCD0 Layout: ${width}x${height}`);
                if (height < 10) {
                    console.error('[InteractiveMapView] ❌ Container height is too small:', height);
                }
            }}
        >
            {/* ✅ FIX 2026-03-11: Indicateur de chargement NON-BLOQUANT (pas d'overlay opaque) */}
            {/* Lt('interactiveMapView.overlayOpaqueEmpechaitMapviewDeS')initialiser sur certains Android */}
            {!mapReady && (
                <View style={styles.loadingBanner}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.loadingBannerText}>{t('interactiveMapView.chargementDeLaCarte')}</Text>
                </View>
            )}

            <MapView
                ref={mapRef}
                style={styles.map}
                provider={Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined}
                mapType={getMapType()}
                initialRegion={startRegion}
                onRegionChangeComplete={(region) => {
                    currentRegionRef.current = region;
                }}
                onPress={handleMapPress}
                onMapReady={() => {
                    console.log('[InteractiveMapView] ✅ Map ready');
                    setMapReady(true);
                }}
                showsUserLocation={true}
                showsMyLocationButton={false}
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
                minZoomLevel={5}
                maxZoomLevel={20}
            >
                {/* Marqueur de position sélectionnée */}
                {selectedLocation && zoneType !== 'polygon' && (
                    <Marker
                        coordinate={{
                            latitude: selectedLocation.lat,
                            longitude: selectedLocation.lng,
                        }}
                        title={t('interactiveMapView.positionSelectionnee')}
                        description={`${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`}
                        pinColor="#EF4444"
                        tracksViewChanges={false}
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

            {/* Contrôles de carte compacts à droite */}
            <View style={styles.mapControls}>
                <TouchableOpacity
                    style={styles.zoomBtn}
                    onPress={() => {
                        const cur = currentRegionRef.current;
                        mapRef.current?.animateToRegion({
                            ...cur,
                            latitudeDelta: cur.latitudeDelta * 0.5,
                            longitudeDelta: cur.longitudeDelta * 0.5,
                        }, 300);
                    }}
                >
                    <SafeIcon name="plus" size={20} color="#333" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.zoomBtn}
                    onPress={() => {
                        const cur = currentRegionRef.current;
                        mapRef.current?.animateToRegion({
                            ...cur,
                            latitudeDelta: Math.min(cur.latitudeDelta * 2, 10),
                            longitudeDelta: Math.min(cur.longitudeDelta * 2, 10),
                        }, 300);
                    }}
                >
                    <SafeIcon name="minus" size={20} color="#333" />
                </TouchableOpacity>

                {/* Centrer sur la position sélectionnée */}
                {selectedLocation && (
                    <TouchableOpacity
                        style={[styles.zoomBtn, { backgroundColor: modernColors.primary }]}
                        onPress={() => {
                            mapRef.current?.animateToRegion({
                                latitude: selectedLocation.lat,
                                longitude: selectedLocation.lng,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                            }, 600);
                        }}
                    >
                        <SafeIcon name="crosshair" size={20} color="#FFF" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Légende compacte en bas */}
            <View style={styles.legend}>
                {zoneType === 'polygon' ? (
                    <>
                        <Text style={styles.legendText}>
                            {localPolygonPoints.length} point{localPolygonPoints.length !== 1 ? 's' : ''}
                            {localPolygonPoints.length < 3 && ' (min. 3)'}
                        </Text>
                        {localPolygonPoints.length > 0 && (
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={clearPolygon}
                            >
                                <SafeIcon name="trash-2" size={14} color="#FFF" />
                            </TouchableOpacity>
                        )}
                    </>
                ) : selectedLocation ? (
                    <Text style={styles.legendText}>
                        \uD83D\uDCCD {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                    </Text>
                ) : (
                    <Text style={[styles.legendText, { color: '#9CA3AF' }]}>Touchez la carte pour placer un point</Text>
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
    loadingBanner: {
        position: 'absolute',
        top: 50,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        zIndex: 10,
        gap: 8,
    },
    loadingBannerText: {
        fontSize: 13,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    mapControls: {
        position: 'absolute',
        top: 12,
        right: 12,
        gap: 8,
    },
    zoomBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    legend: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        backgroundColor: 'rgba(255,255,255,0.92)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    legendText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    clearButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
