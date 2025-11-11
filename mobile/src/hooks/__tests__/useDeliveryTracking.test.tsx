import { act, renderHook, waitFor } from '@testing-library/react';
import type { DeliveryRealtimeEvent, DeliverySummary } from '@types/delivery';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeliveryTracking } from '../useDeliveryTracking';

type Listener = (event: DeliveryRealtimeEvent) => void;

const mockRefreshDelivery = vi.fn();
const mockRegisterListener = vi.fn();
const mockGetDeliveryById = vi.fn();
const mockGetEvents = vi.fn();

let currentDelivery: DeliverySummary;
let currentEvents: DeliveryRealtimeEvent[];
let registeredListener: Listener | null = null;

const mockContext: any = {
    getDeliveryById: (...args: unknown[]) => mockGetDeliveryById(...args),
    getEvents: (...args: unknown[]) => mockGetEvents(...args),
    refreshDelivery: (...args: unknown[]) => mockRefreshDelivery(...args),
    registerDeliveryListener: (...args: unknown[]) => mockRegisterListener(...args),
    loading: false,
    error: null,
    isNetworkOnline: true,
    isWebSocketConnected: true,
    pendingMutationCount: 0,
    retryPendingMutations: vi.fn(),
};

vi.mock('@contexts/DeliveryContext', () => ({
    useDeliveryContext: () => mockContext,
}));

const baseDelivery: DeliverySummary = {
    id: 'delivery-mobile-1',
    kind: 'shopping',
    status: 'shopping_in_progress',
    clientId: 'client-42',
    pickup: {
        label: 'Supermarché mobile',
        latitude: 3.89,
        longitude: 11.51,
    },
    dropoff: {
        label: 'Maison mobile',
        latitude: 3.91,
        longitude: 11.49,
    },
    checkpoints: [
        {
            status: 'shopping_in_progress',
            timestamp: '2025-11-10T09:50:00.000Z',
        },
        {
            status: 'en_route_delivery',
            timestamp: '2025-11-10T09:55:00.000Z',
        },
    ],
    metadata: {
        platform: 'mobile',
    },
};

const initialEvents: DeliveryRealtimeEvent[] = [
    {
        type: 'delivery_status',
        deliveryId: 'delivery-mobile-1',
        timestamp: '2025-11-10T09:55:00.000Z',
        payload: { status: 'en_route_delivery' },
    },
];

describe('useDeliveryTracking (mobile)', () => {
    beforeEach(() => {
        currentDelivery = JSON.parse(JSON.stringify(baseDelivery));
        currentEvents = [...initialEvents];
        registeredListener = null;

        mockGetDeliveryById.mockReset();
        mockGetEvents.mockReset();
        mockRefreshDelivery.mockReset();
        mockRegisterListener.mockReset();

        mockGetDeliveryById.mockImplementation(() => currentDelivery);
        mockGetEvents.mockImplementation(() => currentEvents);
        mockRegisterListener.mockImplementation((deliveryId: string, listener: Listener) => {
            if (deliveryId === currentDelivery.id) {
                registeredListener = listener;
            }
            return () => {
                registeredListener = null;
            };
        });
    });

    it('orders checkpoints chronologically for the timeline', async () => {
        const { result } = renderHook(() => useDeliveryTracking('delivery-mobile-1'));

        await waitFor(() => expect(mockRegisterListener).toHaveBeenCalledWith('delivery-mobile-1', expect.any(Function)));

        const statuses = result.current.timeline.map(item => item.status);
        expect(statuses).toEqual(['shopping_in_progress', 'en_route_delivery']);
    });

    it('tracks last location event distinctly from last event', async () => {
        const { result } = renderHook(() => useDeliveryTracking('delivery-mobile-1'));
        await waitFor(() => registeredListener !== null);

        const locationEvent: DeliveryRealtimeEvent = {
            type: 'delivery_location',
            deliveryId: 'delivery-mobile-1',
            timestamp: '2025-11-10T10:00:00.000Z',
            payload: {
                latitude: 3.92,
                longitude: 11.5,
                source: 'courier',
            },
        };

        currentDelivery = {
            ...currentDelivery,
            courier: {
                id: 'courier-9',
                name: 'Coursier Mobile',
                etaMinutes: 8,
            },
            checkpoints: [...currentDelivery.checkpoints],
        };
        currentEvents = [...currentEvents, locationEvent];

        act(() => {
            registeredListener?.(locationEvent);
        });

        await waitFor(() => expect(result.current.lastEvent?.type).toBe('delivery_location'));
        expect(result.current.lastLocationEvent).toEqual(locationEvent);
        expect(result.current.delivery?.courier?.etaMinutes).toBe(8);
    });

    it('refresh resets transient event state', async () => {
        const { result } = renderHook(() => useDeliveryTracking('delivery-mobile-1'));
        await waitFor(() => registeredListener !== null);

        mockRefreshDelivery.mockResolvedValueOnce(undefined);

        await act(async () => {
            await result.current.refresh({ force: true });
        });

        expect(mockRefreshDelivery).toHaveBeenCalledWith('delivery-mobile-1', { force: true });
        expect(result.current.lastEvent).toBeNull();
        expect(result.current.lastLocationEvent).toBeNull();
    });
});
