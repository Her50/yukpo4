import { useCallback, useMemo, useState } from 'react';

import { useShoppingContext } from '../contexts/ShoppingContext';
import { walletApi } from '../services/api';

export const useWalletBalance = () => {
    const { walletBalance, refreshWalletBalance } = useShoppingContext();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            await refreshWalletBalance();
            setError(null);
        } catch (err: any) {
            console.error('[useWalletBalance] refresh error:', err);
            setError(err?.message ?? 'Erreur solde portefeuille');
        } finally {
            setLoading(false);
        }
    }, [refreshWalletBalance]);

    const forceFetch = useCallback(async () => {
        setLoading(true);
        try {
            const response = await walletApi.getBalance();
            if (!response.success) {
                setError(response.error ?? 'Erreur récupération solde');
            } else {
                setError(null);
            }
        } catch (err: any) {
            setError(err?.message ?? 'Erreur récupération solde');
        } finally {
            setLoading(false);
        }
    }, []);

    return useMemo(
        () => ({
            walletBalance,
            loading,
            error,
            refresh,
            forceFetch,
        }),
        [walletBalance, loading, error, refresh, forceFetch]
    );
};

export default useWalletBalance;


