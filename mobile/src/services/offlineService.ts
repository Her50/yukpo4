// @ts-nocheck
// ✅ Service de gestion mode offline
// Cache local, queue de synchronisation, détection connexion

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import NetInfo from '@react-native-community/netinfo';
import { EventEmitter } from 'events';
import SafeStorage from '../utils/safeStorage';

export interface OfflineAction {
    id: string;
    type: 'api_call' | 'create' | 'update' | 'delete';
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    payload?: any;
    timestamp: number;
    retryCount: number;
    maxRetries: number;
}

export interface CachedData {
    key: string;
    data: any;
    timestamp: number;
    ttl: number; // Time to live en millisecondes
}

class OfflineService extends EventEmitter {
    private isOnline: boolean = true;
    private syncQueue: OfflineAction[] = [];
    private cache: Map<string, CachedData> = new Map();
    private syncInProgress: boolean = false;
    private netInfoUnsubscribe: (() => void) | null = null; // ✅ SÉCURITÉ: Stocker la fonction de nettoyage
    private readonly CACHE_PREFIX = '@yukpo_cache:';
    private readonly QUEUE_KEY = '@yukpo_sync_queue';
    private readonly MAX_CACHE_SIZE = 1000; // Nombre max d'entrées en cache
    private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes par défaut

    constructor() {
        super();
        this.init();
    }

    private async init() {
        // Détecter l'état de connexion initial
        const netInfo = await NetInfo.fetch();
        this.isOnline = netInfo.isConnected ?? false;

        // ✅ SÉCURITÉ: NetInfo.addEventListener retourne une fonction de nettoyage
        this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
            const wasOnline = this.isOnline;
            this.isOnline = state.isConnected ?? false;

            if (!wasOnline && this.isOnline) {
                // Reconnexion: synchroniser la queue
                this.emit('online');
                this.syncQueue();
            } else if (wasOnline && !this.isOnline) {
                // Déconnexion
                this.emit('offline');
            }
        });

        // Charger la queue depuis le stockage local
        await this.loadQueue();

        // Nettoyer le cache expiré
        this.cleanExpiredCache();
    }

    // ============================================================================
    // DÉTECTION CONNEXION
    // ============================================================================

    /**
     * Vérifie si l'appareil est en ligne
     */
    isConnected(): boolean {
        return this.isOnline;
    }

    /**
     * Vérifie la connexion de manière asynchrone
     */
    async checkConnection(): Promise<boolean> {
        const netInfo = await NetInfo.fetch();
        this.isOnline = netInfo.isConnected ?? false;
        return this.isOnline;
    }

    // ============================================================================
    // CACHE LOCAL
    // ============================================================================

    /**
     * Met en cache une donnée
     */
    async setCache(key: string, data: any, ttl?: number): Promise<void> {
        const cacheKey = `${this.CACHE_PREFIX}${key}`;
        const cachedData: CachedData = {
            key: cacheKey,
            data,
            timestamp: Date.now(),
            ttl: ttl || this.DEFAULT_TTL,
        };

        // Limiter la taille du cache
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            // Supprimer la plus ancienne entrée
            const oldestKey = Array.from(this.cache.keys())[0];
            this.cache.delete(oldestKey);
            await SafeStorage.removeItem(oldestKey);
        }

        this.cache.set(cacheKey, cachedData);
        await SafeStorage.setItem(cacheKey, JSON.stringify(cachedData));
    }

    /**
     * Récupère une donnée depuis le cache
     */
    async getCache<T>(key: string): Promise<T | null> {
        const cacheKey = `${this.CACHE_PREFIX}${key}`;

        // Vérifier le cache mémoire d'abord
        const cached = this.cache.get(cacheKey);
        if (cached) {
            if (Date.now() - cached.timestamp < cached.ttl) {
                return cached.data as T;
            } else {
                // Expiré
                this.cache.delete(cacheKey);
                await SafeStorage.removeItem(cacheKey);
                return null;
            }
        }

        // Vérifier le stockage local
        try {
            const stored = await SafeStorage.getItem(cacheKey);
            if (stored) {
                const cachedData: CachedData = JSON.parse(stored);
                if (Date.now() - cachedData.timestamp < cachedData.ttl) {
                    // Remettre en cache mémoire
                    this.cache.set(cacheKey, cachedData);
                    return cachedData.data as T;
                } else {
                    // Expiré
                    await SafeStorage.removeItem(cacheKey);
                    return null;
                }
            }
        } catch (error) {
            console.error('[OfflineService] Error reading cache:', error);
        }

        return null;
    }

    /**
     * Supprime une entrée du cache
     */
    async removeCache(key: string): Promise<void> {
        const cacheKey = `${this.CACHE_PREFIX}${key}`;
        this.cache.delete(cacheKey);
        await SafeStorage.removeItem(cacheKey);
    }

    /**
     * Vide tout le cache
     */
    async clearCache(): Promise<void> {
        this.cache.clear();
        const keys = await SafeStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith(this.CACHE_PREFIX));
        await SafeStorage.multiRemove(cacheKeys);
    }

    /**
     * Nettoie le cache expiré
     */
    private cleanExpiredCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp >= cached.ttl) {
                this.cache.delete(key);
                SafeStorage.removeItem(key);
            }
        }
    }

    // ============================================================================
    // QUEUE DE SYNCHRONISATION
    // ============================================================================

    /**
     * Ajoute une action à la queue de synchronisation
     */
    async addToQueue(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
        const offlineAction: OfflineAction = {
            ...action,
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: action.maxRetries || 3,
        };

        this.syncQueue.push(offlineAction);
        await this.saveQueue();
        this.emit('queue_updated', this.syncQueue.length);

        // Si en ligne, essayer de synchroniser immédiatement
        if (this.isOnline) {
            this.syncQueue();
        }

        return offlineAction.id;
    }

    /**
     * Synchronise la queue avec le serveur
     */
    private async syncQueue() {
        if (this.syncInProgress || !this.isOnline || this.syncQueue.length === 0) {
            return;
        }

        this.syncInProgress = true;
        this.emit('sync_started');

        const actionsToSync = [...this.syncQueue];
        const successfulActions: string[] = [];
        const failedActions: OfflineAction[] = [];

        for (const action of actionsToSync) {
            try {
                // Construire les options de requête selon la méthode HTTP
                const options: RequestInit = { method: action.method };
                if (action.payload && ['POST', 'PUT', 'PATCH'].includes(action.method)) {
                    options.body = JSON.stringify(action.payload);
                }
                const response = await apiCall(action.endpoint, options, false); // false = pas de retry (on gère nous-mêmes)
                if (response.success !== false) {
                    successfulActions.push(action.id);
                    console.log('[OfflineService] ✅ Action synchronisée:', action.endpoint);
                } else {
                    throw new Error(response.error || 'Sync failed');
                }
            } catch (error) {
                action.retryCount++;
                if (action.retryCount < action.maxRetries) {
                    failedActions.push(action);
                } else {
                    // Max retries atteint - déplacer vers dead letter
                    console.error('[OfflineService] Action failed after max retries:', action);
                }
            }
        }

        // Supprimer les actions réussies
        this.syncQueue = this.syncQueue.filter(
            a => !successfulActions.includes(a.id)
        );

        // Remettre les actions échouées (pour retry)
        for (const failed of failedActions) {
            if (!this.syncQueue.find(a => a.id === failed.id)) {
                this.syncQueue.push(failed);
            }
        }

        await this.saveQueue();
        this.syncInProgress = false;
        this.emit('sync_completed', {
            successful: successfulActions.length,
            failed: failedActions.length,
        });
    }

    /**
     * Charge la queue depuis le stockage local
     */
    private async loadQueue() {
        try {
            const stored = await SafeStorage.getItem(this.QUEUE_KEY);
            if (stored) {
                this.syncQueue = JSON.parse(stored);
            }
        } catch (error) {
            console.error('[OfflineService] Error loading queue:', error);
        }
    }

    /**
     * Sauvegarde la queue dans le stockage local
     */
    private async saveQueue() {
        try {
            await SafeStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.syncQueue));
        } catch (error) {
            console.error('[OfflineService] Error saving queue:', error);
        }
    }

    /**
     * Récupère le nombre d'actions en attente
     */
    getQueueLength(): number {
        return this.syncQueue.length;
    }

    /**
     * Vide la queue
     */
    async clearQueue(): Promise<void> {
        this.syncQueue = [];
        await SafeStorage.removeItem(this.QUEUE_KEY);
        this.emit('queue_updated', 0);
    }

    /**
     * Nettoie les ressources (appelé lors de la destruction)
     */
    cleanup() {
        // ✅ SÉCURITÉ: Nettoyer le listener NetInfo
        if (this.netInfoUnsubscribe && typeof this.netInfoUnsubscribe === 'function') {
            this.netInfoUnsubscribe();
            this.netInfoUnsubscribe = null;
        }
        // Nettoyer tous les listeners EventEmitter
        this.removeAllListeners();
    }
}

// Export singleton
export const offlineService = new OfflineService();
export default offlineService;
