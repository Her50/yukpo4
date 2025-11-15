import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    createGlobalPromoEvent,
    fetchGlobalPromoEntries,
    fetchGlobalPromoEvents,
    upsertGlobalPromoEntry,
} from '@/services/globalPromoApi';
import type {
    CreateGlobalPromoEventPayload,
    GlobalPromoEntry,
    GlobalPromoEvent,
    UpsertGlobalPromoEntryPayload,
} from '@/types/globalPromo';

interface UseGlobalPromosResult {
    events: GlobalPromoEvent[];
    entries: GlobalPromoEntry[];
    selectedEvent?: GlobalPromoEvent;
    loadingEvents: boolean;
    loadingEntries: boolean;
    error?: string | null;
    selectEvent: (eventId: string | null) => Promise<void>;
    refreshEvents: () => Promise<void>;
    createEvent: (payload: CreateGlobalPromoEventPayload) => Promise<void>;
    upsertEntry: (payload: UpsertGlobalPromoEntryPayload) => Promise<void>;
}

export const useGlobalPromos = (): UseGlobalPromosResult => {
    const [events, setEvents] = useState<GlobalPromoEvent[]>([]);
    const [entries, setEntries] = useState<GlobalPromoEntry[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshEvents = useCallback(async () => {
        try {
            setLoadingEvents(true);
            setError(null);
            const data = await fetchGlobalPromoEvents(false);
            setEvents(data);
            if (!selectedEventId && data.length > 0) {
                setSelectedEventId(data[0].id);
            }
        } catch (err) {
            console.error('[useGlobalPromos] Failed to fetch events', err);
            setError(
                err instanceof Error ? err.message : "Impossible de récupérer les campagnes globales.",
            );
        } finally {
            setLoadingEvents(false);
        }
    }, [selectedEventId]);

    const loadEntries = useCallback(
        async (eventId: string | null) => {
            if (!eventId) {
                setEntries([]);
                return;
            }

            try {
                setLoadingEntries(true);
                setError(null);
                const data = await fetchGlobalPromoEntries(eventId);
                setEntries(data);
            } catch (err) {
                console.error('[useGlobalPromos] Failed to fetch entries', err);
                setError(
                    err instanceof Error ? err.message : 'Impossible de charger les produits de la campagne.',
                );
            } finally {
                setLoadingEntries(false);
            }
        },
        [],
    );

    const selectEvent = useCallback(
        async (eventId: string | null) => {
            setSelectedEventId(eventId);
            await loadEntries(eventId);
        },
        [loadEntries],
    );

    useEffect(() => {
        refreshEvents();
    }, [refreshEvents]);

    useEffect(() => {
        if (selectedEventId) {
            loadEntries(selectedEventId);
        }
    }, [selectedEventId, loadEntries]);

    const createEvent = useCallback(
        async (payload: CreateGlobalPromoEventPayload) => {
            await createGlobalPromoEvent(payload);
            await refreshEvents();
        },
        [refreshEvents],
    );

    const upsertEntryHandler = useCallback(
        async (payload: UpsertGlobalPromoEntryPayload) => {
            if (!selectedEventId) {
                throw new Error('Aucune campagne sélectionnée');
            }
            await upsertGlobalPromoEntry(selectedEventId, payload);
            await loadEntries(selectedEventId);
        },
        [loadEntries, selectedEventId],
    );

    const selectedEvent = useMemo(
        () => events.find((event) => event.id === selectedEventId),
        [events, selectedEventId],
    );

    return {
        events,
        entries,
        selectedEvent,
        loadingEvents,
        loadingEntries,
        error,
        selectEvent,
        refreshEvents,
        createEvent,
        upsertEntry: upsertEntryHandler,
    };
};

export default useGlobalPromos;

