import { useCallback, useEffect, useState } from 'react';

import { fetchMyGlobalPromoEvents, submitGlobalPromoEntry } from '../services/globalPromoService';
import type { SubmitGlobalPromoEntryPayload } from '../types/GlobalPromo';

export const useMyGlobalPromos = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [entries, setEntries] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
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
            console.error('[useMyGlobalPromos] load failed', err);
            setError('Impossible de charger les campagnes globales.');
        } finally {
            setLoading(false);
        }
    }, [selectedEventId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const submit = useCallback(
        async (payload: SubmitGlobalPromoEntryPayload) => {
            if (!selectedEventId) return;
            setSubmitting(true);
            try {
                await submitGlobalPromoEntry(selectedEventId, payload);
                await refresh();
            } catch (err) {
                console.error('[useMyGlobalPromos] submit failed', err);
                setError('Impossible de soumettre votre service. Vérifiez les champs.');
            } finally {
                setSubmitting(false);
            }
        },
        [refresh, selectedEventId],
    );

    return {
        events,
        entries,
        selectedEventId,
        setSelectedEventId,
        loading,
        submitting,
        error,
        refresh,
        submit,
    };
};

export default useMyGlobalPromos;

