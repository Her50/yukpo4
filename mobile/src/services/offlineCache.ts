/**
 * Service de cache hors ligne pour tickets de voyage
 * Gère le stockage local et la synchronisation
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';
import NetInfo from '@react-native-community/netinfo';
import { apiPost } from './api';

const CACHE_KEYS = {
    SEARCH_RESULTS: 'cache_search_results',
    TICKETS: 'cache_tickets',
    PENDING_ACTIONS: 'cache_pending_actions',
    LAST_SYNC: 'cache_last_sync',
};

interface CachedSearchResult {
    query: string;
    results: any[];
    timestamp: number;
    expiresAt: number;
}

interface CachedTicket {
    ticket_id: string;
    data: any;
    timestamp: number;
}

interface PendingAction {
    id: string;
    type: 'reservation' | 'cancellation' | 'update';
    data: any;
    timestamp: number;
}

class OfflineCacheService {
    private isOnline: boolean = true;
    private syncQueue: PendingAction[] = [];

    constructor() {
        this.init();
    }

    private async init() {
        // Vérifier l'état réseau
        const state = await NetInfo.fetch();
        this.isOnline = state.isConnected ?? false;

        // Écouter les changements réseau
        NetInfo.addEventListener((state) => {
            this.isOnline = state.isConnected ?? false;
            if (this.isOnline) {
                this.syncPendingActions();
            }
        });

        // Charger la queue de synchronisation
        await this.loadSyncQueue();
    }

    /**
     * Vérifier si on est en ligne
     */
    isConnected(): boolean {
        return this.isOnline;
    }

    /**
     * Mettre en cache les résultats de recherche
     */
    async cacheSearchResults(query: string, results: any[], ttlMinutes: number = 30) {
        try {
            const cached: CachedSearchResult = {
                query,
                results,
                timestamp: Date.now(),
                expiresAt: Date.now() + ttlMinutes * 60 * 1000,
            };

            const existing = await SafeStorage.getItem(CACHE_KEYS.SEARCH_RESULTS);
            const cache = existing ? JSON.parse(existing) : {};
            cache[query] = cached;

            await SafeStorage.setItem(CACHE_KEYS.SEARCH_RESULTS, JSON.stringify(cache));
        } catch (error) {
            console.error('[OfflineCache] Erreur cache recherche:', error);
        }
    }

    /**
     * Récupérer les résultats de recherche depuis le cache
     */
    async getCachedSearchResults(query: string): Promise<any[] | null> {
        try {
            const existing = await SafeStorage.getItem(CACHE_KEYS.SEARCH_RESULTS);
            if (!existing) return null;

            const cache = JSON.parse(existing);
            const cached = cache[query] as CachedSearchResult | undefined;

            if (!cached) return null;

            // Vérifier expiration
            if (Date.now() > cached.expiresAt) {
                delete cache[query];
                await SafeStorage.setItem(CACHE_KEYS.SEARCH_RESULTS, JSON.stringify(cache));
                return null;
            }

            return cached.results;
        } catch (error) {
            console.error('[OfflineCache] Erreur récupération cache:', error);
            return null;
        }
    }

    /**
     * Mettre en cache un ticket
     */
    async cacheTicket(ticketId: string, ticketData: any) {
        try {
            const cached: CachedTicket = {
                ticket_id: ticketId,
                data: ticketData,
                timestamp: Date.now(),
            };

            const existing = await SafeStorage.getItem(CACHE_KEYS.TICKETS);
            const tickets = existing ? JSON.parse(existing) : {};
            tickets[ticketId] = cached;

            await SafeStorage.setItem(CACHE_KEYS.TICKETS, JSON.stringify(tickets));
        } catch (error) {
            console.error('[OfflineCache] Erreur cache ticket:', error);
        }
    }

    /**
     * Récupérer un ticket depuis le cache
     */
    async getCachedTicket(ticketId: string): Promise<any | null> {
        try {
            const existing = await SafeStorage.getItem(CACHE_KEYS.TICKETS);
            if (!existing) return null;

            const tickets = JSON.parse(existing);
            const cached = tickets[ticketId] as CachedTicket | undefined;

            return cached?.data || null;
        } catch (error) {
            console.error('[OfflineCache] Erreur récupération ticket:', error);
            return null;
        }
    }

    /**
     * Récupérer tous les tickets en cache
     */
    async getAllCachedTickets(): Promise<any[]> {
        try {
            const existing = await SafeStorage.getItem(CACHE_KEYS.TICKETS);
            if (!existing) return [];

            const tickets = JSON.parse(existing);
            return Object.values(tickets).map((t: any) => t.data);
        } catch (error) {
            console.error('[OfflineCache] Erreur récupération tickets:', error);
            return [];
        }
    }

    /**
     * Ajouter une action en attente de synchronisation
     */
    async addPendingAction(type: PendingAction['type'], data: any) {
        try {
            const action: PendingAction = {
                id: `${Date.now()}_${Math.random()}`,
                type,
                data,
                timestamp: Date.now(),
            };

            this.syncQueue.push(action);
            await this.saveSyncQueue();

            // Essayer de synchroniser immédiatement si en ligne
            if (this.isOnline) {
                await this.syncPendingActions();
            }
        } catch (error) {
            console.error('[OfflineCache] Erreur ajout action:', error);
        }
    }

    /**
     * Synchroniser les actions en attente
     */
    async syncPendingActions() {
        if (!this.isOnline || this.syncQueue.length === 0) return;

        const actions = [...this.syncQueue];
        const successful: string[] = [];

        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'reservation':
                        await apiPost('/api/bus-tickets/reserve', action.data);
                        successful.push(action.id);
                        break;
                    case 'cancellation':
                        await apiPost('/api/bus-tickets/cancel', action.data);
                        successful.push(action.id);
                        break;
                    case 'update':
                        await apiPost('/api/bus-tickets/update', action.data);
                        successful.push(action.id);
                        break;
                }
            } catch (error) {
                console.error(`[OfflineCache] Erreur sync action ${action.id}:`, error);
                // Garder l'action en queue pour réessayer plus tard
            }
        }

        // Retirer les actions réussies
        this.syncQueue = this.syncQueue.filter((a) => !successful.includes(a.id));
        await this.saveSyncQueue();
    }

    /**
     * Sauvegarder la queue de synchronisation
     */
    private async saveSyncQueue() {
        try {
            await SafeStorage.setItem(CACHE_KEYS.PENDING_ACTIONS, JSON.stringify(this.syncQueue));
        } catch (error) {
            console.error('[OfflineCache] Erreur sauvegarde queue:', error);
        }
    }

    /**
     * Charger la queue de synchronisation
     */
    private async loadSyncQueue() {
        try {
            const existing = await SafeStorage.getItem(CACHE_KEYS.PENDING_ACTIONS);
            if (existing) {
                this.syncQueue = JSON.parse(existing);
            }
        } catch (error) {
            console.error('[OfflineCache] Erreur chargement queue:', error);
        }
    }

    /**
     * Nettoyer le cache expiré
     */
    async cleanExpiredCache() {
        try {
            // Nettoyer recherches expirées
            const existing = await SafeStorage.getItem(CACHE_KEYS.SEARCH_RESULTS);
            if (existing) {
                const cache = JSON.parse(existing);
                const now = Date.now();
                Object.keys(cache).forEach((key) => {
                    if (cache[key].expiresAt < now) {
                        delete cache[key];
                    }
                });
                await SafeStorage.setItem(CACHE_KEYS.SEARCH_RESULTS, JSON.stringify(cache));
            }

            // Nettoyer tickets anciens (garder 30 jours)
            const ticketsExisting = await SafeStorage.getItem(CACHE_KEYS.TICKETS);
            if (ticketsExisting) {
                const tickets = JSON.parse(ticketsExisting);
                const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
                Object.keys(tickets).forEach((key) => {
                    if (tickets[key].timestamp < thirtyDaysAgo) {
                        delete tickets[key];
                    }
                });
                await SafeStorage.setItem(CACHE_KEYS.TICKETS, JSON.stringify(tickets));
            }
        } catch (error) {
            console.error('[OfflineCache] Erreur nettoyage cache:', error);
        }
    }

    /**
     * Obtenir le nombre d'actions en attente
     */
    getPendingActionsCount(): number {
        return this.syncQueue.length;
    }
}

export const offlineCache = new OfflineCacheService();
export default offlineCache;


