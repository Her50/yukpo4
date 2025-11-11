import { useDeliveryContext } from '@/context/DeliveryContext';
import { DeliveryRealtimeEvent, DeliverySummary } from '@/types/delivery';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface DeliveryTrackingState {
    delivery: DeliverySummary | null;
    events: DeliveryRealtimeEvent[];
    lastEvent: DeliveryRealtimeEvent | null;
}

export const useDeliveryTracking = (deliveryId: string | null) => {
    const {
        getDelivery,
        getEvents,
        refreshDelivery,
        registerListener,
        loading,
        error,
    } = useDeliveryContext();

    const [state, setState] = useState<DeliveryTrackingState>({
        delivery: deliveryId ? getDelivery(deliveryId) : null,
        events: deliveryId ? getEvents(deliveryId) : [],
        lastEvent: null,
    });

    useEffect(() => {
        if (!deliveryId) {
            setState({ delivery: null, events: [], lastEvent: null });
            return;
        }

        setState({
            delivery: getDelivery(deliveryId),
            events: getEvents(deliveryId),
            lastEvent: null,
        });

        const unsubscribe = registerListener(deliveryId, event => {
            setState({
                delivery: getDelivery(deliveryId),
                events: getEvents(deliveryId),
                lastEvent: event,
            });
        });

        return () => {
            unsubscribe();
        };
    }, [deliveryId, getDelivery, getEvents, registerListener]);

    const refresh = useCallback(
        async (opts?: { force?: boolean }) => {
            if (!deliveryId) return;
            await refreshDelivery(deliveryId, opts);
            setState({
                delivery: getDelivery(deliveryId),
                events: getEvents(deliveryId),
                lastEvent: null,
            });
        },
        [deliveryId, refreshDelivery, getDelivery, getEvents],
    );

    const timeline = useMemo(() => {
        if (!state.delivery) {
            return [];
        }
        return [...state.delivery.checkpoints].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }, [state.delivery]);

    return {
        delivery: state.delivery,
        events: state.events,
        lastEvent: state.lastEvent,
        timeline,
        refresh,
        loading,
        error,
    };
};

export default useDeliveryTracking;


