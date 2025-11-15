import { useCallback, useEffect, useState } from 'react';

import { fetchGlobalPromoCatalog } from '../services/globalPromoService';
import type { GlobalPromoCatalogItem } from '../types/GlobalPromo';

export const useGlobalPromos = () => {
    const [catalog, setCatalog] = useState<GlobalPromoCatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchGlobalPromoCatalog();
            setCatalog(data);
        } catch (err) {
            console.error('[useGlobalPromos] Impossible de charger les promos globales', err);
            setError('Impossible de récupérer les promotions Black Friday.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        catalog,
        loading,
        error,
        refresh,
    };
};

export default useGlobalPromos;

