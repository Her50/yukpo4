// ✅ Phase 6.2: Hook pour détecter le mode hors ligne avec NetInfo

import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface OfflineModeResult {
    isOffline: boolean;
    isOnline: boolean;
    isConnected: boolean | null;
    connectionType: string | null;
}

/**
 * Hook pour détecter le mode hors ligne
 * Utilise NetInfo pour surveiller l'état de la connexion réseau
 */
export const useOfflineMode = (): OfflineModeResult => {
    const [isOffline, setIsOffline] = useState(false);
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [connectionType, setConnectionType] = useState<string | null>(null);

    useEffect(() => {
        // Vérifier l'état initial
        const checkInitialState = async () => {
            const state = await NetInfo.fetch();
            setIsConnected(state.isConnected);
            setIsOffline(!state.isConnected);
            setConnectionType(state.type);
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        checkInitialState().catch(error => {
            console.error('[useOfflineMode] Erreur checkInitialState:', error);
        });

        // Écouter les changements de connexion
        const unsubscribe = NetInfo.addEventListener((state) => {
            const connected = state.isConnected ?? false;
            setIsConnected(connected);
            setIsOffline(!connected);
            setConnectionType(state.type);

            console.log('[useOfflineMode] État connexion:', {
                isConnected: connected,
                type: state.type,
                isInternetReachable: state.isInternetReachable,
            });
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return {
        isOffline: isOffline,
        isOnline: !isOffline && isConnected === true,
        isConnected,
        connectionType,
    };
};



