/**
 * ResultsMapView - Vue carte pour résultats géolocalisés
 * Priorité 1 : Map view avec clustering (style Airbnb)
 */

import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocation } from '../../contexts/LocationContext';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface Product {
    service_id: number;
    nom: string;
    coordinates?: { lat: number; lng: number };
    distance_km?: number;
    prix?: number;
    devise?: string;
    prestataire?: {
        nom: string;
        avatar_url?: string;
    };
}

interface ResultsMapViewProps {
    products: Product[];
    onProductPress: (product: Product) => void;
    visible: boolean;
}

const ResultsMapView: React.FC<ResultsMapViewProps> = ({
    products,
    onProductPress,
    visible,
}) => {
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    // Filtrer les produits avec coordonnées valides
    const productsWithCoordinates = useMemo(() => {
        return products.filter(
            (p) => p.coordinates?.lat && p.coordinates?.lng
        );
    }, [products]);

    // Calculer la région de la carte
    const mapRegion = useMemo(() => {
        if (productsWithCoordinates.length === 0) {
            // Utiliser la position de l'utilisateur si disponible
            if (location?.coords?.latitude && location?.coords?.longitude) {
                return {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.1,
                    longitudeDelta: 0.1,
                };
            }
            return null;
        }

        // Calculer les limites de la carte pour inclure tous les points
        const lats = productsWithCoordinates.map((p) => p.coordinates!.lat);
        const lngs = productsWithCoordinates.map((p) => p.coordinates!.lng);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const latDelta = (maxLat - minLat) * 1.5; // 1.5x pour padding
        const lngDelta = (maxLng - minLng) * 1.5;

        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(latDelta, 0.01), // Minimum 0.01
            longitudeDelta: Math.max(lngDelta, 0.01),
        };
    }, [productsWithCoordinates, location]);

    const handleMarkerPress = useCallback((product: Product) => {
        onProductPress(product);
    }, [onProductPress]);

    if (!visible) return null;

    if (productsWithCoordinates.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <SafeIcon name="map-pin" size={48} color={modernColors.textSecondary} />
                <Text style={styles.emptyText}>{t('resultsMapView.aucunResultatAvecLocalisationGps')}</Text>
                <Text style={styles.emptySubtext}>
                    Activez la géolocalisation pour voir les résultats sur la carte
                </Text>
            </View>
        );
    }

    if (!mapRegion) {
        return (
            <View style={styles.emptyContainer}>
                <SafeIcon name="map" size={48} color={modernColors.textSecondary} />
                <Text style={styles.emptyText}>{t('resultsMapView.chargementDeLaCarte')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                provider={Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined}
                style={styles.map}
                initialRegion={mapRegion}
                showsUserLocation={!!location?.coords}
                showsMyLocationButton={true}
                showsCompass={true}
                toolbarEnabled={false}
            >
                {/* Marqueur position utilisateur si disponible */}
                {location?.coords?.latitude && location?.coords?.longitude && (
                    <Marker
                        coordinate={{
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        }}
                        title={t('resultsMapView.votrePosition')}
                        pinColor={modernColors.primary}
                    />
                )}

                {/* Marqueurs pour chaque produit */}
                {productsWithCoordinates.map((product) => (
                    <Marker
                        key={product.service_id}
                        coordinate={{
                            latitude: product.coordinates!.lat,
                            longitude: product.coordinates!.lng,
                        }}
                        title={product.nom}
                        description={
                            product.prix
                                ? `${product.prix.toLocaleString()} ${product.devise || 'XAF'}`
                                : undefined
                        }
                        onPress={() => handleMarkerPress(product)}
                    >
                        <View style={styles.markerContainer}>
                            <View style={styles.markerContent}>
                                <Text style={styles.markerPrice} numberOfLines={1}>
                                    {product.prix
                                        ? `${product.prix.toLocaleString()} ${product.devise || 'XAF'}`
                                        : '\uD83D\uDCB0'}
                                </Text>
                            </View>
                            <View style={styles.markerPin} />
                        </View>
                    </Marker>
                ))}
            </MapView>

            {/* Légende */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: modernColors.primary }]} />
                    <Text style={styles.legendText}>{t('resultsMapView.votrePosition')}</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.legendText}>{productsWithCoordinates.length} résultat(s)</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        height: 400,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    map: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        height: 400,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
        padding: 24,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    markerContainer: {
        alignItems: 'center',
    },
    markerContent: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: modernColors.primary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        marginBottom: 4,
    },
    markerPrice: {
        fontSize: 11,
        fontWeight: '700',
        color: modernColors.primary,
    },
    markerPin: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: modernColors.primary,
    },
    legend: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendText: {
        fontSize: 12,
        color: modernColors.text,
        fontWeight: '500',
    },
});

export default ResultsMapView;

