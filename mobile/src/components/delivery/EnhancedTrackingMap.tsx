import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { LatLng, Marker, Polyline } from 'react-native-maps';
import { modernColors } from '../../theme/modernTheme';
import { DeliveryLocation } from '../../types/delivery';
import { SafeIcon } from '../SafeIcon';

const { width } = Dimensions.get('window');

interface DeliveryPoint {
    lat: number;
    lng: number;
    label?: string;
    subtitle?: string;
}

interface EnhancedTrackingMapProps {
    pickup?: DeliveryPoint | null;
    dropoff?: DeliveryPoint | null;
    courierLocation?: DeliveryLocation | null;
    recipientLocation?: DeliveryLocation | null;
    waypoints?: Array<{ lat: number; lng: number }>;
    onNavigationPress?: () => void;
    showNavigationButton?: boolean;
}

const toLatLng = (point?: { lat: number; lng: number } | null): LatLng | undefined => {
    if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
        return undefined;
    }
    return {
        latitude: point.lat,
        longitude: point.lng,
    };
};

const EnhancedTrackingMap: React.FC<EnhancedTrackingMapProps> = ({
    pickup,
    dropoff,
    courierLocation,
    recipientLocation,
    waypoints = [],
    onNavigationPress,
    showNavigationButton = true,
}) => {
    const mapRef = useRef<MapView>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;
    const [mapReady, setMapReady] = useState(false);

    const markers = React.useMemo(() => {
        const points: LatLng[] = [];
        const pickupLatLng = toLatLng(pickup);
        const dropoffLatLng = toLatLng(dropoff);
        const courierLatLng = toLatLng(courierLocation);
        const recipientLatLng = toLatLng(recipientLocation);

        if (pickupLatLng) points.push(pickupLatLng);
        if (dropoffLatLng) points.push(dropoffLatLng);
        if (courierLatLng) points.push(courierLatLng);
        if (recipientLatLng) points.push(recipientLatLng);
        waypoints.forEach(point => {
            const latLng = toLatLng(point);
            if (latLng) {
                points.push(latLng);
            }
        });

        return {
            pickup: pickupLatLng,
            dropoff: dropoffLatLng,
            courier: courierLatLng,
            recipient: recipientLatLng,
            all: points,
        };
    }, [pickup, dropoff, courierLocation, recipientLocation, waypoints]);

    // Animation pulse pour le marqueur coursier
    useEffect(() => {
        if (markers.courier) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.3,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [markers.courier, pulseAnim]);

    // Animation du bouton navigation
    const handleNavigationPress = () => {
        Animated.sequence([
            Animated.spring(buttonScale, {
                toValue: 0.95,
                useNativeDriver: true,
            }),
            Animated.spring(buttonScale, {
                toValue: 1,
                useNativeDriver: true,
            }),
        ]).start();
        onNavigationPress?.();
    };

    React.useEffect(() => {
        if (!mapReady || !mapRef.current || markers.all.length === 0) {
            return;
        }

        mapRef.current.fitToCoordinates(markers.all, {
            edgePadding: {
                top: 64,
                right: 32,
                bottom: 64,
                left: 32,
            },
            animated: true,
        });
    }, [mapReady, markers.all]);

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                showsCompass
                showsTraffic={false}
                showsIndoors={false}
                showsMyLocationButton={false}
                mapType="standard"
                onMapReady={() => setMapReady(true)}
            >
                {markers.pickup ? (
                    <Marker coordinate={markers.pickup} pinColor={modernColors.primary} tracksViewChanges={false}>
                        <View style={styles.markerBubble}>
                            <View style={[styles.markerIcon, { backgroundColor: modernColors.primary }]}>
                                <SafeIcon name="shopping-cart" size={16} color="#fff" />
                            </View>
                            <Text style={styles.markerText}>{pickup?.label ?? 'Pickup'}</Text>
                        </View>
                    </Marker>
                ) : null}

                {markers.dropoff ? (
                    <Marker coordinate={markers.dropoff} pinColor={modernColors.accent} tracksViewChanges={false}>
                        <View style={styles.markerBubble}>
                            <View style={[styles.markerIcon, { backgroundColor: modernColors.accent }]}>
                                <SafeIcon name="location" size={16} color="#fff" />
                            </View>
                            <Text style={styles.markerText}>{dropoff?.label ?? 'Dropoff'}</Text>
                        </View>
                    </Marker>
                ) : null}

                {markers.courier ? (
                    <Marker coordinate={markers.courier} tracksViewChanges={false}>
                        <Animated.View
                            style={[
                                styles.courierMarker,
                                {
                                    transform: [{ scale: pulseAnim }],
                                },
                            ]}
                        >
                            <View style={styles.courierMarkerInner}>
                                <SafeIcon name="car" size={20} color="#fff" />
                            </View>
                            <View style={styles.courierPulse} />
                        </Animated.View>
                    </Marker>
                ) : null}

                {markers.recipient ? (
                    <Marker coordinate={markers.recipient} pinColor={modernColors.success} tracksViewChanges={false}>
                        <View style={styles.markerBubble}>
                            <View style={[styles.markerIcon, { backgroundColor: modernColors.success }]}>
                                <SafeIcon name="profile" size={16} color="#fff" />
                            </View>
                            <Text style={styles.markerText}>Destinataire</Text>
                        </View>
                    </Marker>
                ) : null}

                {markers.all.length >= 2 ? (
                    <Polyline
                        coordinates={markers.all}
                        strokeColor={modernColors.primary}
                        strokeWidth={4}
                        lineCap="round"
                        lineJoin="round"
                    />
                ) : null}
            </MapView>

            {showNavigationButton && pickup && dropoff && onNavigationPress && (
                <Animated.View
                    style={[
                        styles.navigationButton,
                        {
                            transform: [{ scale: buttonScale }],
                        },
                    ]}
                >
                    <TouchableOpacity
                        onPress={handleNavigationPress}
                        activeOpacity={0.8}
                        style={styles.navigationButtonInner}
                    >
                        <SafeIcon name="navigation" size={22} color="#fff" />
                        <Text style={styles.navigationButtonText}>Navigation</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        height: width * 0.65,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    markerBubble: {
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 5,
    },
    markerIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    markerText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    courierMarker: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    courierMarkerInner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.info,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 8,
    },
    courierPulse: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
        backgroundColor: modernColors.info + '30',
    },
    navigationButton: {
        position: 'absolute',
        bottom: 16,
        right: 16,
    },
    navigationButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 28,
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 8,
    },
    navigationButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});

export default EnhancedTrackingMap;

