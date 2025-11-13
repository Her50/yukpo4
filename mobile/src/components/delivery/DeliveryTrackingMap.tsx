import React, { useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import MapView, { LatLng, Marker, Polyline } from 'react-native-maps';

import { modernColors } from '../../theme/modernTheme';
import { DeliveryLocation } from '../../types/delivery';
import SafeIcon from '../SafeIcon';

const { width } = Dimensions.get('window');

interface DeliveryPoint {
    lat: number;
    lng: number;
    label?: string;
    subtitle?: string;
}

interface DeliveryTrackingMapProps {
    pickup?: DeliveryPoint | null;
    dropoff?: DeliveryPoint | null;
    courierLocation?: DeliveryLocation | null;
    recipientLocation?: DeliveryLocation | null;
    waypoints?: Array<{ lat: number; lng: number }>;
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

const DeliveryTrackingMap: React.FC<DeliveryTrackingMapProps> = ({
    pickup,
    dropoff,
    courierLocation,
    recipientLocation,
    waypoints = [],
}) => {
    const mapRef = useRef<MapView>(null);

    const markers = useMemo(() => {
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

    React.useEffect(() => {
        if (!mapRef.current || markers.all.length === 0) {
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
    }, [markers.all]);

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                showsCompass
                showsTraffic={false}
                showsIndoors={false}
                showsMyLocationButton
            >
                {markers.pickup ? (
                    <Marker coordinate={markers.pickup} pinColor={modernColors.primary}>
                        <View style={styles.markerBubble}>
                            <SafeIcon name="shopping-cart" size={14} color="#fff" />
                            <Text style={styles.markerText}>{pickup?.label ?? 'Pickup'}</Text>
                        </View>
                    </Marker>
                ) : null}

                {markers.dropoff ? (
                    <Marker coordinate={markers.dropoff} pinColor={modernColors.accent}>
                        <View style={styles.markerBubble}>
                            <SafeIcon name="location" size={14} color="#fff" />
                            <Text style={styles.markerText}>{dropoff?.label ?? 'Dropoff'}</Text>
                        </View>
                    </Marker>
                ) : null}

                {markers.courier ? (
                    <Marker coordinate={markers.courier} pinColor={modernColors.info}>
                        <View style={styles.markerBubble}>
                            <SafeIcon name="car" size={14} color="#fff" />
                            <Text style={styles.markerText}>Coursier</Text>
                        </View>
                    </Marker>
                ) : null}

                {markers.recipient ? (
                    <Marker coordinate={markers.recipient} pinColor={modernColors.success}>
                        <View style={styles.markerBubble}>
                            <SafeIcon name="profile" size={14} color="#fff" />
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        height: width * 0.65,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    markerBubble: {
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    markerText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
});

export default DeliveryTrackingMap;


