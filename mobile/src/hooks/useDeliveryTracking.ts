import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDeliveryContext } from '../contexts/DeliveryContext';
import { DeliveryRealtimeEvent, DeliverySummary } from '../types/delivery';

interface DeliveryTrackingState {
    delivery: DeliverySummary | null;
    events: DeliveryRealtimeEvent[];
    lastEvent: DeliveryRealtimeEvent | null;
    lastLocationEvent: DeliveryRealtimeEvent | null;
}

export const useDeliveryTracking = (deliveryId: string | null) => {
    const {
        getDeliveryById,
        getEvents,
        registerDeliveryListener,
        refreshDelivery,
        loading,
        error,
    } = useDeliveryContext();

    const [state, setState] = useState<DeliveryTrackingState>({
        delivery: deliveryId ? getDeliveryById(deliveryId) : null,
        events: deliveryId ? getEvents(deliveryId) : [],
        lastEvent: null,
        lastLocationEvent: null,
    });

    useEffect(() => {
        if (!deliveryId) {
            setState({
                delivery: null,
                events: [],
                lastEvent: null,
                lastLocationEvent: null,
            });
            return;
        }

        setState({
            delivery: getDeliveryById(deliveryId),
            events: getEvents(deliveryId),
            lastEvent: null,
            lastLocationEvent: null,
        });
    }, [deliveryId, getDeliveryById, getEvents]);

    useEffect(() => {
        if (!deliveryId) {
            return;
        }

        const unsubscribe = registerDeliveryListener(deliveryId, event => {
            setState(prev => ({
                delivery: getDeliveryById(deliveryId),
                events: getEvents(deliveryId),
                lastEvent: event,
                lastLocationEvent: event.type === 'delivery_location' ? event : prev.lastLocationEvent,
            }));
        });

        return () => {
            unsubscribe?.();
        };
    }, [deliveryId, getDeliveryById, getEvents, registerDeliveryListener]);

    const refresh = useCallback(
        async (options?: { force?: boolean }) => {
            if (!deliveryId) {
                return;
            }
            await refreshDelivery(deliveryId, options);
            setState({
                delivery: getDeliveryById(deliveryId),
                events: getEvents(deliveryId),
                lastEvent: null,
                lastLocationEvent: null,
            });
        },
        [deliveryId, refreshDelivery, getDeliveryById, getEvents]
    );

    const timeline = useMemo(() => {
        if (!state.delivery) {
            return [];
        }

        return [...(state.delivery.checkpoints ?? [])].sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp)
        );
    }, [state.delivery]);

    return {
        delivery: state.delivery,
        events: state.events,
        lastEvent: state.lastEvent,
        lastLocationEvent: state.lastLocationEvent,
        timeline,
        refresh,
        loading,
        error,
    };
};

export default useDeliveryTracking;


