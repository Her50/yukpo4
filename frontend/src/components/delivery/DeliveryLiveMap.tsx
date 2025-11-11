import { DeliveryRealtimeEvent, DeliverySummary } from '@/types/delivery';
import 'leaflet/dist/leaflet.css';
import {
    CircleMarker,
    MapContainer,
    Marker,
    Polyline,
    TileLayer,
    Tooltip,
    useMap,
} from 'react-leaflet';
import React, { useEffect, useMemo } from 'react';
import L, { LatLngExpression, LatLngTuple } from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

interface DeliveryLiveMapProps {
    delivery: DeliverySummary;
    events: DeliveryRealtimeEvent[];
    height?: number;
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const COLORS = {
    pickup: '#2563EB',
    dropoff: '#7C3AED',
    courier: '#F97316',
    recipient: '#22C55E',
    route: '#4F46E5',
};

const isValidCoordinate = (lat?: number | null, lng?: number | null): lat is number =>
    typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);

const FitBounds: React.FC<{ points: LatLngTuple[] }> = ({ points }) => {
    const map = useMap();

    useEffect(() => {
        if (!points.length) return;
        if (points.length === 1) {
            map.setView(points[0], 15, { animate: true });
            return;
        }
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [24, 24] });
    }, [map, points]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            map.invalidateSize();
        }, 150);
        return () => clearTimeout(timeout);
    }, [map]);

    return null;
};

const buildCourierTrail = (events: DeliveryRealtimeEvent[]): LatLngTuple[] =>
    events
        .filter(event => event.type === 'delivery_location' && event.payload?.source === 'courier')
        .map(event => {
            const { latitude, longitude } = event.payload ?? {};
            if (!isValidCoordinate(latitude, longitude)) {
                return null;
            }
            return [latitude as number, longitude as number] as LatLngTuple;
        })
        .filter((point): point is LatLngTuple => Array.isArray(point));

const buildLatestCoord = (
    events: DeliveryRealtimeEvent[],
    source: 'courier' | 'recipient',
): LatLngTuple | null => {
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event.type !== 'delivery_location') continue;
        if (event.payload?.source !== source) continue;
        const { latitude, longitude } = event.payload ?? {};
        if (isValidCoordinate(latitude, longitude)) {
            return [latitude as number, longitude as number];
        }
    }
    return null;
};

const DeliveryLiveMap: React.FC<DeliveryLiveMapProps> = ({ delivery, events, height = 320 }) => {
    const pickupPoint = useMemo(() => {
        if (isValidCoordinate(delivery.pickup.latitude, delivery.pickup.longitude)) {
            return [delivery.pickup.latitude!, delivery.pickup.longitude!] as LatLngTuple;
        }
        return null;
    }, [delivery.pickup.latitude, delivery.pickup.longitude]);

    const dropoffPoint = useMemo(() => {
        if (isValidCoordinate(delivery.dropoff.latitude, delivery.dropoff.longitude)) {
            return [delivery.dropoff.latitude!, delivery.dropoff.longitude!] as LatLngTuple;
        }
        return null;
    }, [delivery.dropoff.latitude, delivery.dropoff.longitude]);

    const recipientPoint = useMemo(() => {
        const location = delivery.recipient?.currentLocation;
        if (!location) return null;
        if (!delivery.recipient?.allowTracking) return null;
        if (isValidCoordinate(location.latitude, location.longitude)) {
            return [location.latitude, location.longitude] as LatLngTuple;
        }
        return null;
    }, [delivery.recipient]);

    const courierTrail = useMemo(() => buildCourierTrail(events), [events]);
    const courierPoint = useMemo(() => {
        if (courierTrail.length > 0) {
            return courierTrail[courierTrail.length - 1];
        }
        return buildLatestCoord(events, 'courier');
    }, [courierTrail, events]);

    const fallbackRecipientPoint = useMemo(() => {
        if (recipientPoint) return recipientPoint;
        return buildLatestCoord(events, 'recipient');
    }, [events, recipientPoint]);

    const mapPoints = useMemo(() => {
        const points: LatLngTuple[] = [];
        if (pickupPoint) points.push(pickupPoint);
        if (dropoffPoint) points.push(dropoffPoint);
        if (courierPoint) points.push(courierPoint);
        if (fallbackRecipientPoint) points.push(fallbackRecipientPoint);
        return points;
    }, [pickupPoint, dropoffPoint, courierPoint, fallbackRecipientPoint]);

    if (typeof window === 'undefined') {
        return null;
    }

    if (!pickupPoint && !dropoffPoint) {
        return (
            <div
                className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-sm text-slate-500"
                style={{ minHeight: height }}
            >
                Positionnement GPS indisponible pour cette livraison pour le moment.
            </div>
        );
    }

    const routeLine: LatLngExpression[] = [];
    if (pickupPoint) routeLine.push(pickupPoint);
    if (courierPoint) routeLine.push(courierPoint);
    if (dropoffPoint) routeLine.push(dropoffPoint);

    return (
        <div className="rounded-lg border border-slate-200 shadow-sm">
            <MapContainer
                center={mapPoints[0] ?? (pickupPoint ?? dropoffPoint ?? [0, 0])}
                zoom={13}
                style={{ height, width: '100%' }}
                scrollWheelZoom
            >
                <TileLayer url={TILE_URL} />
                <FitBounds points={mapPoints} />

                {pickupPoint ? (
                    <Marker position={pickupPoint}>
                        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                            <div>
                                <strong>Retrait</strong>
                                <div>{delivery.pickup.label ?? 'Supermarché'}</div>
                                {delivery.pickup.address ? (
                                    <div className="text-xs">{delivery.pickup.address}</div>
                                ) : null}
                            </div>
                        </Tooltip>
                    </Marker>
                ) : null}

                {dropoffPoint ? (
                    <Marker position={dropoffPoint}>
                        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                            <div>
                                <strong>Livraison</strong>
                                <div>{delivery.dropoff.label ?? delivery.recipient?.name ?? 'Destinataire'}</div>
                                {delivery.dropoff.address ? (
                                    <div className="text-xs">{delivery.dropoff.address}</div>
                                ) : null}
                            </div>
                        </Tooltip>
                    </Marker>
                ) : null}

                {courierPoint ? (
                    <CircleMarker center={courierPoint} radius={10} pathOptions={{ color: COLORS.courier }}>
                        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                            <div>
                                <strong>Coursier</strong>
                                <div>{delivery.courier?.name ?? 'Coursier Yukpo'}</div>
                            </div>
                        </Tooltip>
                    </CircleMarker>
                ) : null}

                {fallbackRecipientPoint ? (
                    <CircleMarker
                        center={fallbackRecipientPoint}
                        radius={8}
                        pathOptions={{ color: COLORS.recipient }}
                    >
                        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                            <div>
                                <strong>Destinataire</strong>
                                <div>{delivery.recipient?.name ?? 'Client final'}</div>
                                {delivery.recipient?.allowTracking
                                    ? 'Partage de position actif'
                                    : 'Position estimée'}
                            </div>
                        </Tooltip>
                    </CircleMarker>
                ) : null}

                {courierTrail.length > 1 ? (
                    <Polyline
                        positions={courierTrail}
                        pathOptions={{ color: COLORS.courier, weight: 4, dashArray: '6 6' }}
                    />
                ) : null}

                {routeLine.length > 1 ? (
                    <Polyline positions={routeLine} pathOptions={{ color: COLORS.route, weight: 2, opacity: 0.5 }} />
                ) : null}
            </MapContainer>

            <div className="flex flex-wrap gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                <LegendDot color={COLORS.pickup} label="Retrait" />
                <LegendDot color={COLORS.dropoff} label="Livraison" />
                <LegendDot color={COLORS.courier} label="Coursier" />
                <LegendDot color={COLORS.recipient} label="Destinataire" />
            </div>
        </div>
    );
};

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span>{label}</span>
    </span>
);

export default DeliveryLiveMap;

