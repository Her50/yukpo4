import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    fetchMyGlobalPromoEvents,
    submitMyGlobalPromoEntry
} from '@/services/globalPromoApi';
import type {
    GlobalPromoEntry,
    GlobalPromoEvent,
    UpsertGlobalPromoEntryPayload,
} from '@/types/globalPromo';

interface UseMyGlobalPromosResult {
    events: GlobalPromoEvent[];
    entries: GlobalPromoEntry[];
    selectedEvent?: GlobalPromoEvent;
    loading: boolean;
    submitting: boolean;
    error?: string | null;
    selectEvent: (id: string) => void;
    refresh: () => Promise<void>;
    submitEntry: (payload: UpsertGlobalPromoEntryPayload) => Promise<void>;
}

export const useMyGlobalPromos = (): UseMyGlobalPromosResult => {
    const [events, setEvents] = useState<GlobalPromoEvent[]>([]);
    const [entries, setEntries] = useState<GlobalPromoEntry[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { events, entries } = await fetchMyGlobalPromoEvents();
            setEvents(events);
            setEntries(entries);
            if (!selectedEventId && events.length > 0) {
                setSelectedEventId(events[0].id);
            }
        } catch (err) {
            console.error('[useMyGlobalPromos] Failed to load data', err);
            setError(
                err instanceof Error ? err.message : 'Impossible de charger les promotions globales.',
            );
        } finally {
            setLoading(false);
        }
    }, [selectedEventId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const selectEvent = useCallback((id: string) => {
        setSelectedEventId(id);
    }, []);

    const submitEntry = useCallback(
        async (payload: UpsertGlobalPromoEntryPayload) => {
            if (!selectedEventId) {
                throw new Error('Aucune campagne disponible');
            }
            setSubmitting(true);
            setError(null);
            try {
                await submitMyGlobalPromoEntry(selectedEventId, payload);
                await refresh();
            } catch (err) {
                console.error('[useMyGlobalPromos] Submission failed', err);
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Impossible de soumettre votre produit à la campagne',
                );
            } finally {
                setSubmitting(false);
            }
        },
        [refresh, selectedEventId],
    );

    const selectedEvent = useMemo(
        () => events.find((event) => event.id === selectedEventId),
        [events, selectedEventId],
    );

    return {
        events,
        entries,
        selectedEvent,
        loading,
        submitting,
        error,
        selectEvent,
        refresh,
        submitEntry,
    };
};

export default useMyGlobalPromos;

