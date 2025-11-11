import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeliveryTracking } from '../useDeliveryTracking';
import type { DeliveryRealtimeEvent, DeliverySummary } from '@/types/delivery';

type Listener = (event: DeliveryRealtimeEvent) => void;

const mockRefreshDelivery = vi.fn();
const mockRegisterListener = vi.fn();
const mockGetDelivery = vi.fn();
const mockGetEvents = vi.fn();

let currentDelivery: DeliverySummary;
let currentEvents: DeliveryRealtimeEvent[];
let registeredListener: Listener | null = null;

const mockContext: any = {
    getDelivery: (...args: unknown[]) => mockGetDelivery(...args),
    getEvents: (...args: unknown[]) => mockGetEvents(...args),
    refreshDelivery: (...args: unknown[]) => mockRefreshDelivery(...args),
    registerListener: (...args: unknown[]) => mockRegisterListener(...args),
    loading: false,
    error: null,
};

vi.mock('@/context/DeliveryContext', () => ({
    useDeliveryContext: () => mockContext,
}));

const baseDelivery: DeliverySummary = {
    id: 'delivery-1',
    kind: 'shopping',
    status: 'shopping_in_progress',
    clientId: 'client-1',
    pickup: {
        label: 'Supermarché',
        latitude: 3.85,
        longitude: 11.5,
    },
    dropoff: {
        label: 'Maison client',
        latitude: 3.9,
        longitude: 11.48,
    },
    checkpoints: [
        {
            status: 'shopping_pending',
            timestamp: '2025-11-10T10:00:00.000Z',
        },
        {
            status: 'shopping_in_progress',
            timestamp: '2025-11-10T09:55:00.000Z',
        },
    ],
    metadata: {
        shopping: true,
    },
};

const initialEvents: DeliveryRealtimeEvent[] = [
    {
        type: 'shopping_update',
        deliveryId: 'delivery-1',
        timestamp: '2025-11-10T10:00:00.000Z',
        payload: { items: [] },
    },
];

describe('useDeliveryTracking', () => {
    beforeEach(() => {
        currentDelivery = JSON.parse(JSON.stringify(baseDelivery));
        currentEvents = [...initialEvents];
        registeredListener = null;

        mockGetDelivery.mockReset();
        mockGetEvents.mockReset();
        mockGetDelivery.mockImplementation(() => currentDelivery);
        mockGetEvents.mockImplementation(() => currentEvents);
        mockRefreshDelivery.mockReset();
        mockRegisterListener.mockReset();
        mockRegisterListener.mockImplementation((deliveryId: string, listener: Listener) => {
            if (deliveryId === currentDelivery.id) {
                registeredListener = listener;
            }
            return () => {
                registeredListener = null;
            };
        });
    });

    it('returns sorted timeline based on checkpoints', async () => {
        const { result } = renderHook(() => useDeliveryTracking('delivery-1'));

        await waitFor(() => expect(mockRegisterListener).toHaveBeenCalledWith('delivery-1', expect.any(Function)));

        const timelineStatuses = result.current.timeline.map(item => item.status);
        expect(timelineStatuses).toEqual(['shopping_in_progress', 'shopping_pending']);
    });

    it('updates state when a realtime event is received', async () => {
        const { result } = renderHook(() => useDeliveryTracking('delivery-1'));
        await waitFor(() => registeredListener !== null);

        const newEvent: DeliveryRealtimeEvent = {
            type: 'recipient_dropoff',
            deliveryId: 'delivery-1',
            timestamp: '2025-11-10T10:05:00.000Z',
            payload: { status: 'delivered' },
        };

        currentDelivery = {
            ...currentDelivery,
            status: 'delivered',
            checkpoints: [
                ...currentDelivery.checkpoints,
                {
                    status: 'delivered',
                    timestamp: newEvent.timestamp,
                    actor: 'recipient',
                },
            ],
        };
        currentEvents = [...currentEvents, newEvent];

        act(() => {
            registeredListener?.(newEvent);
        });

        await waitFor(() => expect(result.current.lastEvent?.type).toBe('recipient_dropoff'));
        expect(result.current.delivery?.status).toBe('delivered');
        expect(result.current.timeline.at(-1)?.status).toBe('delivered');
    });

    it('triggers backend refresh on demand', async () => {
        const { result } = renderHook(() => useDeliveryTracking('delivery-1'));
        await waitFor(() => registeredListener !== null);

        mockRefreshDelivery.mockResolvedValueOnce(undefined);

        await act(async () => {
            await result.current.refresh({ force: true });
        });

        expect(mockRefreshDelivery).toHaveBeenCalledWith('delivery-1', { force: true });
        expect(result.current.lastEvent).toBeNull();
    });
});
