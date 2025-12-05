// ✅ Hook React pour utiliser le service offline
import { useEffect, useState } from 'react';
import offlineService, { OfflineAction } from '../services/offlineService';

export interface UseOfflineReturn {
    isOnline: boolean;
    isSyncing: boolean;
    queueLength: number;
    checkConnection: () => Promise<boolean>;
    getCache: <T>(key: string) => Promise<T | null>;
    setCache: (key: string, data: any, ttl?: number) => Promise<void>;
    addToQueue: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) => Promise<string>;
}

export const useOffline = (): UseOfflineReturn => {
    const [isOnline, setIsOnline] = useState(offlineService.isConnected());
    const [isSyncing, setIsSyncing] = useState(false);
    const [queueLength, setQueueLength] = useState(offlineService.getQueueLength());

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        const handleSyncStarted = () => setIsSyncing(true);
        const handleSyncCompleted = () => setIsSyncing(false);
        const handleQueueUpdated = (length: number) => setQueueLength(length);

        offlineService.on('online', handleOnline);
        offlineService.on('offline', handleOffline);
        offlineService.on('sync_started', handleSyncStarted);
        offlineService.on('sync_completed', handleSyncCompleted);
        offlineService.on('queue_updated', handleQueueUpdated);

        return () => {
            offlineService.off('online', handleOnline);
            offlineService.off('offline', handleOffline);
            offlineService.off('sync_started', handleSyncStarted);
            offlineService.off('sync_completed', handleSyncCompleted);
            offlineService.off('queue_updated', handleQueueUpdated);
        };
    }, []);

    return {
        isOnline,
        isSyncing,
        queueLength,
        checkConnection: offlineService.checkConnection.bind(offlineService),
        getCache: offlineService.getCache.bind(offlineService),
        setCache: offlineService.setCache.bind(offlineService),
        addToQueue: offlineService.addToQueue.bind(offlineService),
    };
};

