// ✅ Phase 6.2: Service de stockage hors ligne pour services spécialisés
// Utilise AsyncStorage pour sauvegarder les données en cache

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';

const STORAGE_KEYS = {
    SERVICES_LIST: '@specialized_services:list',
    SERVICES_STATS: '@specialized_services:stats',
    SYNC_QUEUE: '@specialized_services:sync_queue',
    LAST_SYNC: '@specialized_services:last_sync',
    OFFLINE_MODE: '@specialized_services:offline_mode',
} as const;

export interface CachedService {
    id: number;
    service_id: number;
    type: string;
    nom: string;
    is_active: boolean;
    is_available_now?: boolean;
    created_at: string;
    updated_at: string;
    metadata?: any;
}

export interface SyncQueueItem {
    id: string;
    action: 'create' | 'update' | 'delete' | 'toggle_status';
    service_id?: number;
    data?: any;
    timestamp: number;
    retries: number;
}

export interface OfflineStorageService {
    // Services
    saveServices: (services: CachedService[]) => Promise<void>;
    getServices: () => Promise<CachedService[] | null>;
    clearServices: () => Promise<void>;

    // Statistiques
    saveStatistics: (stats: any) => Promise<void>;
    getStatistics: () => Promise<any | null>;

    // Queue de synchronisation
    addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>) => Promise<void>;
    getSyncQueue: () => Promise<SyncQueueItem[]>;
    removeFromSyncQueue: (id: string) => Promise<void>;
    clearSyncQueue: () => Promise<void>;

    // Métadonnées
    setLastSync: (timestamp: number) => Promise<void>;
    getLastSync: () => Promise<number | null>;
    setOfflineMode: (isOffline: boolean) => Promise<void>;
    getOfflineMode: () => Promise<boolean>;
}

class OfflineStorageServiceImpl implements OfflineStorageService {
    // Services
    async saveServices(services: CachedService[]): Promise<void> {
        try {
            await SafeStorage.setItem(
                STORAGE_KEYS.SERVICES_LIST,
                JSON.stringify(services)
            );
            console.log('[OfflineStorage] ✅ Services sauvegardés:', services.length);
        } catch (error) {
            console.error('[OfflineStorage] Erreur sauvegarde services:', error);
            throw error;
        }
    }

    async getServices(): Promise<CachedService[] | null> {
        try {
            const data = await SafeStorage.getItem(STORAGE_KEYS.SERVICES_LIST);
            if (!data) return null;
            return JSON.parse(data) as CachedService[];
        } catch (error) {
            console.error('[OfflineStorage] Erreur récupération services:', error);
            return null;
        }
    }

    async clearServices(): Promise<void> {
        try {
            await SafeStorage.removeItem(STORAGE_KEYS.SERVICES_LIST);
        } catch (error) {
            console.error('[OfflineStorage] Erreur suppression services:', error);
        }
    }

    // Statistiques
    async saveStatistics(stats: any): Promise<void> {
        try {
            await SafeStorage.setItem(
                STORAGE_KEYS.SERVICES_STATS,
                JSON.stringify(stats)
            );
        } catch (error) {
            console.error('[OfflineStorage] Erreur sauvegarde stats:', error);
        }
    }

    async getStatistics(): Promise<any | null> {
        try {
            const data = await SafeStorage.getItem(STORAGE_KEYS.SERVICES_STATS);
            if (!data) return null;
            return JSON.parse(data);
        } catch (error) {
            console.error('[OfflineStorage] Erreur récupération stats:', error);
            return null;
        }
    }

    // Queue de synchronisation
    async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
        try {
            const queue = await this.getSyncQueue();
            const newItem: SyncQueueItem = {
                ...item,
                id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                retries: 0,
            };
            queue.push(newItem);
            await SafeStorage.setItem(
                STORAGE_KEYS.SYNC_QUEUE,
                JSON.stringify(queue)
            );
            console.log('[OfflineStorage] ✅ Item ajouté à la queue:', newItem.id);
        } catch (error) {
            console.error('[OfflineStorage] Erreur ajout queue:', error);
            throw error;
        }
    }

    async getSyncQueue(): Promise<SyncQueueItem[]> {
        try {
            const data = await SafeStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
            if (!data) return [];
            return JSON.parse(data) as SyncQueueItem[];
        } catch (error) {
            console.error('[OfflineStorage] Erreur récupération queue:', error);
            return [];
        }
    }

    async removeFromSyncQueue(id: string): Promise<void> {
        try {
            const queue = await this.getSyncQueue();
            const filtered = queue.filter((item) => item.id !== id);
            await SafeStorage.setItem(
                STORAGE_KEYS.SYNC_QUEUE,
                JSON.stringify(filtered)
            );
        } catch (error) {
            console.error('[OfflineStorage] Erreur suppression queue:', error);
        }
    }

    async clearSyncQueue(): Promise<void> {
        try {
            await SafeStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
        } catch (error) {
            console.error('[OfflineStorage] Erreur suppression queue:', error);
        }
    }

    // Métadonnées
    async setLastSync(timestamp: number): Promise<void> {
        try {
            await SafeStorage.setItem(
                STORAGE_KEYS.LAST_SYNC,
                timestamp.toString()
            );
        } catch (error) {
            console.error('[OfflineStorage] Erreur sauvegarde last sync:', error);
        }
    }

    async getLastSync(): Promise<number | null> {
        try {
            const data = await SafeStorage.getItem(STORAGE_KEYS.LAST_SYNC);
            if (!data) return null;
            return parseInt(data, 10);
        } catch (error) {
            console.error('[OfflineStorage] Erreur récupération last sync:', error);
            return null;
        }
    }

    async setOfflineMode(isOffline: boolean): Promise<void> {
        try {
            await SafeStorage.setItem(
                STORAGE_KEYS.OFFLINE_MODE,
                isOffline ? 'true' : 'false'
            );
        } catch (error) {
            console.error('[OfflineStorage] Erreur sauvegarde offline mode:', error);
        }
    }

    async getOfflineMode(): Promise<boolean> {
        try {
            const data = await SafeStorage.getItem(STORAGE_KEYS.OFFLINE_MODE);
            return data === 'true';
        } catch (error) {
            console.error('[OfflineStorage] Erreur récupération offline mode:', error);
            return false;
        }
    }
}

export const offlineStorage: OfflineStorageService = new OfflineStorageServiceImpl();



