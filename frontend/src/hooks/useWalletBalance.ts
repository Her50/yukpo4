import { useShopping } from '@/context/ShoppingContext';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const useWalletBalance = () => {
    const { balance, refreshBalance } = useShopping();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (balance === undefined && !loading) {
            void refresh();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            await refreshBalance();
            setError(null);
        } catch (err) {
            console.error('[useWalletBalance] refresh error', err);
            setError(err instanceof Error ? err.message : 'Impossible de récupérer le solde');
        } finally {
            setLoading(false);
        }
    }, [refreshBalance]);

    return useMemo(
        () => ({
            balance,
            loading,
            error,
            refresh,
        }),
        [balance, loading, error, refresh],
    );
};

export default useWalletBalance;


