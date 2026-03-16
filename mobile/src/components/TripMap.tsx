/**
 * Composant pour afficher une carte interactive du trajet
 * Affiche le tracé de la route entre départ et arrivée
 */

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface TripMapProps {
    departureCity: string;
    arrivalCity: string;
    departureCoordinates?: { latitude: number; longitude: number };
    arrivalCoordinates?: { latitude: number; longitude: number };
    routeCoordinates?: Array<{ latitude: number; longitude: number }>;
    distanceKm?: number;
    durationMinutes?: number;
}

const TripMap: React.FC<TripMapProps> = ({
    departureCity,
    arrivalCity,
    departureCoordinates,
    arrivalCoordinates,
    routeCoordinates,
    distanceKm,
    durationMinutes,
}) => {
    const mapRef = useRef<MapView>(null);
        const { t } = useLanguageSafe();
const [loading, setLoading] = useState(true);
    const [region, setRegion] = useState({
        latitude: 7.3697, // Yaoundé par défaut
        longitude: 12.3547,
        latitudeDelta: 5,
        longitudeDelta: 5,
    });

    useEffect(() => {
        if (departureCoordinates && arrivalCoordinates) {
            // Calculer la région pour afficher les deux points
            const minLat = Math.min(departureCoordinates.latitude, arrivalCoordinates.latitude);
            const maxLat = Math.max(departureCoordinates.latitude, arrivalCoordinates.latitude);
            const minLng = Math.min(departureCoordinates.longitude, arrivalCoordinates.longitude);
            const maxLng = Math.max(departureCoordinates.longitude, arrivalCoordinates.longitude);

            const newRegion = {
                latitude: (minLat + maxLat) / 2,
                longitude: (minLng + maxLng) / 2,
                latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.5),
                longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.5),
            };

            setRegion(newRegion);
            setLoading(false);

            // Ajuster la vue de la carte
            if (mapRef.current) {
                mapRef.current.fitToCoordinates(
                    [departureCoordinates, arrivalCoordinates],
                    {
                        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                        animated: true,
                    }
                );
            }
        } else {
            // Géocoder les villes si les coordonnées ne sont pas fournies
            geocodeCities();
        }
    }, [departureCoordinates, arrivalCoordinates, departureCity, arrivalCity]);

    const geocodeCities = async () => {
        try {
            // TODO: Utiliser le backend ou Google Geocoding API
            // Pour l'instant, utiliser des coordonnées par défaut pour les villes camerounaises
            const cityCoordinates: { [key: string]: { lat: number; lng: number } } = {
                t('tripMap.yaounde'): { lat: 3.848, lng: 11.5021 },
                'douala': { lat: 4.0511, lng: 9.7679 },
                'bafoussam': { lat: 5.4737, lng: 10.4176 },
                'bamenda': { lat: 6.1584, lng: 10.1703 },
                'garoua': { lat: 9.3004, lng: 13.3975 },
            };

            const depKey = departureCity.toLowerCase();
            const arrKey = arrivalCity.toLowerCase();

            const depCoords = cityCoordinates[depKey] || cityCoordinates[t('tripMap.yaounde')];
            const arrCoords = cityCoordinates[arrKey] || cityCoordinates['douala'];

            const minLat = Math.min(depCoords.lat, arrCoords.lat);
            const maxLat = Math.max(depCoords.lat, arrCoords.lat);
            const minLng = Math.min(depCoords.lng, arrCoords.lng);
            const maxLng = Math.max(depCoords.lng, arrCoords.lng);

            const newRegion = {
                latitude: (minLat + maxLat) / 2,
                longitude: (minLng + maxLng) / 2,
                latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.5),
                longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.5),
            };

            setRegion(newRegion);
            setLoading(false);
        } catch (error) {
            console.error('[TripMap] Erreur géocodage:', error);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('tripMap.chargementDeLaCarte')}</Text>
            </View>
        );
    }

    const depCoords = departureCoordinates || {
        latitude: 3.848,
        longitude: 11.5021,
    };
    const arrCoords = arrivalCoordinates || {
        latitude: 4.0511,
        longitude: 9.7679,
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('tripMap.itineraire')}</Text>
                {distanceKm && (
                    <View style={styles.infoBadge}>
                        <SafeIcon name="map" size={14} color={modernColors.primary} />
                        <Text style={styles.infoText}>{distanceKm.toFixed(0)} km</Text>
                    </View>
                )}
                {durationMinutes && (
                    <View style={styles.infoBadge}>
                        <SafeIcon name="clock" size={14} color={modernColors.primary} />
                        <Text style={styles.infoText}>{durationMinutes} min</Text>
                    </View>
                )}
            </View>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={region}
                showsUserLocation={false}
                showsMyLocationButton={false}
            >
                {/* Marqueur départ */}
                <Marker
                    coordinate={depCoords}
                    title={departureCity}
                    description="Point de départ"
                >
                    <View style={styles.markerContainer}>
                        <View style={[styles.marker, styles.markerDeparture]}>
                            <SafeIcon name="map-pin" size={20} color="#fff" />
                        </View>
                    </View>
                </Marker>

                {/* Marqueur arrivée */}
                <Marker
                    coordinate={arrCoords}
                    title={arrivalCity}
                    description="Point d'arrivée"
                >
                    <View style={styles.markerContainer}>
                        <View style={[styles.marker, styles.markerArrival]}>
                            <SafeIcon name="map-pin" size={20} color="#fff" />
                        </View>
                    </View>
                </Marker>

                {/* Ligne de route */}
                {routeCoordinates && routeCoordinates.length > 0 ? (
                    <Polyline
                        coordinates={routeCoordinates}
                        strokeColor={modernColors.primary}
                        strokeWidth={3}
                    />
                ) : (
                    <Polyline
                        coordinates={[depCoords, arrCoords]}
                        strokeColor={modernColors.primary}
                        strokeWidth={3}
                        lineDashPattern={[5, 5]}
                    />
                )}
            </MapView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    infoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
    },
    infoText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    map: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        overflow: 'hidden',
    },
    loadingContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
    },
    loadingText: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
    },
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    marker: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    markerDeparture: {
        backgroundColor: modernColors.primary,
    },
    markerArrival: {
        backgroundColor: '#10B981',
    },
});

export default TripMap;


