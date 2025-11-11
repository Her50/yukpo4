import type { DeliveryRealtimeEvent, DeliverySummary } from '@/types/delivery';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DeliveryLiveMap from '../DeliveryLiveMap';

vi.mock('leaflet', () => {
    const mergeOptions = vi.fn();
    const proto: Record<string, unknown> = { _getIconUrl: vi.fn() };
    function IconDefault() { }
    IconDefault.prototype = proto;
    IconDefault.mergeOptions = mergeOptions;
    return {
        default: {
            Icon: { Default: IconDefault },
            latLngBounds: vi.fn(() => ({})),
        },
        Icon: { Default: IconDefault },
        latLngBounds: vi.fn(() => ({})),
    };
});

const mapApi = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
};

vi.mock('react-leaflet', () => {
    const React = require('react');
    return {
        MapContainer: ({ children }: { children: React.ReactNode }) => (
            <div data-testid="map-container">{children}</div>
        ),
        Marker: ({ position, children }: { position: any; children?: React.ReactNode }) => (
            <div data-testid="marker" data-position={JSON.stringify(position)}>
                {children}
            </div>
        ),
        CircleMarker: ({
            center,
            pathOptions,
            children,
        }: {
            center: any;
            pathOptions?: { color?: string };
            children?: React.ReactNode;
        }) => (
            <div
                data-testid="circle-marker"
                data-center={JSON.stringify(center)}
                data-color={pathOptions?.color ?? ''}
            >
                {children}
            </div>
        ),
        Polyline: ({ positions, pathOptions }: { positions: any; pathOptions?: Record<string, unknown> }) => (
            <div data-testid="polyline" data-positions={JSON.stringify(positions)}>
                {JSON.stringify(pathOptions)}
            </div>
        ),
        TileLayer: () => <div data-testid="tile-layer" />,
        Tooltip: ({ children }: { children?: React.ReactNode }) => (
            <div data-testid="tooltip">{children}</div>
        ),
        useMap: () => mapApi,
    };
});

const baseDelivery: DeliverySummary = {
    id: 'delivery-1',
    kind: 'shopping',
    status: 'en_route_delivery',
    pickup: {
        label: 'Supermarché',
        address: 'Quartier A',
        latitude: 3.85,
        longitude: 11.5,
    },
    dropoff: {
        label: 'Destinataire',
        address: 'Quartier B',
        latitude: 3.86,
        longitude: 11.51,
    },
    checkpoints: [],
    courier: {
        name: 'Coursier Test',
    },
    recipient: {
        name: 'Client Test',
        allowTracking: false,
    },
};

const buildEvent = (
    source: 'courier' | 'recipient',
    latitude: number,
    longitude: number,
): DeliveryRealtimeEvent<{ latitude: number; longitude: number; source: string }> => ({
    type: 'delivery_location',
    deliveryId: 'delivery-1',
    timestamp: new Date().toISOString(),
    payload: {
        latitude,
        longitude,
        source,
    },
});

describe('DeliveryLiveMap', () => {
    beforeEach(() => {
        mapApi.setView.mockClear();
        mapApi.fitBounds.mockClear();
        mapApi.invalidateSize.mockClear();
    });

    it('affiche un message fallback lorsque les coordonnées sont absentes', () => {
        const delivery = {
            ...baseDelivery,
            pickup: { label: 'Supermarché', address: 'Quartier A' },
            dropoff: { label: 'Destinataire', address: 'Quartier B' },
        };

        render(<DeliveryLiveMap delivery={delivery} events={[]} />);

        expect(
            screen.getByText('Positionnement GPS indisponible pour cette livraison pour le moment.'),
        ).toBeInTheDocument();
        expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
    });

    it('rend les points pickup, dropoff et la position courante du coursier', () => {
        const events = [
            buildEvent('courier', 3.855, 11.505),
            buildEvent('recipient', 3.857, 11.507),
        ];

        render(<DeliveryLiveMap delivery={baseDelivery} events={events} />);

        const markers = screen.getAllByTestId('marker');
        expect(markers).toHaveLength(2);

        const circleMarkers = screen.getAllByTestId('circle-marker');
        expect(circleMarkers).toHaveLength(2);

        expect(screen.getAllByTestId('polyline').length).toBeGreaterThan(0);
        expect(mapApi.fitBounds).toHaveBeenCalled();
    });
});

