// Composant carte interactive avec clustering pour biens immobiliers
import React, { useEffect, useRef, useState } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { RealEstateProperty } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface PropertyMapViewProps {
    properties: RealEstateProperty[];
    onPropertyPress?: (property: RealEstateProperty) => void;
    initialRegion?: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    };
    showClustering?: boolean;
}

const PropertyMapView: React.FC<PropertyMapViewProps> = ({
    properties,
    onPropertyPress,
    initialRegion,
    showClustering = true,
}) => {
    const mapRef = useRef<MapView>(null);
    const [selectedProperty, setSelectedProperty] = useState<RealEstateProperty | null>(null);
    const [mapRegion, setMapRegion] = useState(initialRegion);

    useEffect(() => {
        if (properties.length > 0 && !initialRegion) {
            // Calculer la région centrée sur tous les biens
            const validProperties = properties.filter(
                (p) => p.gps && p.gps.includes(',')
            );

            if (validProperties.length > 0) {
                const coordinates = validProperties.map((p) => {
                    const [lat, lng] = p.gps!.split(',').map(Number);
                    return { latitude: lat, longitude: lng };
                });

                const minLat = Math.min(...coordinates.map((c) => c.latitude));
                const maxLat = Math.max(...coordinates.map((c) => c.latitude));
                const minLng = Math.min(...coordinates.map((c) => c.longitude));
                const maxLng = Math.max(...coordinates.map((c) => c.longitude));

                const centerLat = (minLat + maxLat) / 2;
                const centerLng = (minLng + maxLng) / 2;
                const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
                const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);

                setMapRegion({
                    latitude: centerLat,
                    longitude: centerLng,
                    latitudeDelta: latDelta,
                    longitudeDelta: lngDelta,
                });
            }
        }
    }, [properties, initialRegion]);

    const formatPrice = (price?: number) => {
        if (!price) return 'Prix sur demande';
        if (price >= 1000000) {
            return `${(price / 1000000).toFixed(1)}M`;
        }
        return `${(price / 1000).toFixed(0)}K`;
    };

    const handleMarkerPress = (property: RealEstateProperty) => {
        setSelectedProperty(property);
        if (onPropertyPress) {
            onPropertyPress(property);
        }
    };

    const getMarkerColor = (property: RealEstateProperty) => {
        if (property.statut?.includes('vendre')) return '#EF4444'; // Rouge pour vente
        if (property.statut?.includes('louer')) return '#3B82F6'; // Bleu pour location
        return '#10B981'; // Vert par défaut
    };

    if (!mapRegion) {
        return (
            <View style={styles.container}>
                <View style={styles.noLocationContainer}>
                    <SafeIcon name="map-pin" size={48} color="#9CA3AF" />
                    <Text style={styles.noLocationText}>
                        Aucune localisation disponible
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                provider={Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined}
                style={styles.map}
                initialRegion={mapRegion}
                onRegionChangeComplete={setMapRegion}
                showsUserLocation
                showsMyLocationButton
            >
                {properties
                    .filter((p) => p.gps && p.gps.includes(','))
                    .map((property) => {
                        const [lat, lng] = property.gps!.split(',').map(Number);
                        return (
                            <Marker
                                key={property.id}
                                coordinate={{ latitude: lat, longitude: lng }}
                                onPress={() => handleMarkerPress(property)}
                            >
                                <View
                                    style={[
                                        styles.markerContainer,
                                        { backgroundColor: getMarkerColor(property) },
                                    ]}
                                >
                                    <Text style={styles.markerPrice}>
                                        {formatPrice(
                                            property.prix_vente || property.prix_location_mensuel
                                        )}
                                    </Text>
                                </View>
                            </Marker>
                        );
                    })}
            </MapView>

            {/* Info bulle pour le bien sélectionné */}
            {selectedProperty && (
                <View style={styles.infoBubble}>
                    <TouchableOpacity
                        style={styles.infoBubbleContent}
                        onPress={() => {
                            if (onPropertyPress) {
                                onPropertyPress(selectedProperty);
                            }
                        }}
                    >
                        <Text style={styles.infoBubbleTitle} numberOfLines={1}>
                            {selectedProperty.titre}
                        </Text>
                        <Text style={styles.infoBubblePrice}>
                            {formatPrice(
                                selectedProperty.prix_vente ||
                                selectedProperty.prix_location_mensuel
                            )}{' '}
                            FCFA
                        </Text>
                        <Text style={styles.infoBubbleLocation} numberOfLines={1}>
                            {[selectedProperty.quartier, selectedProperty.ville]
                                .filter(Boolean)
                                .join(', ')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setSelectedProperty(null)}
                    >
                        <SafeIcon name="x" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Légende */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.legendText}>À vendre</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#3B82F6' }]} />
                    <Text style={styles.legendText}>À louer</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 400,
        borderRadius: 12,
        overflow: 'hidden',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    noLocationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    noLocationText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    markerContainer: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#fff',
    },
    markerPrice: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    infoBubble: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoBubbleContent: {
        flex: 1,
    },
    infoBubbleTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    infoBubblePrice: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    infoBubbleLocation: {
        fontSize: 14,
        color: '#6B7280',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    legend: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    legendColor: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 8,
    },
    legendText: {
        fontSize: 12,
        color: '#6B7280',
    },
});

export default PropertyMapView;

