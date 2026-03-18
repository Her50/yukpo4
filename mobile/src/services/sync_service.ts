// ✅ Phase 6.3: Service de synchronisation différée pour services spécialisés
// ✅ Phase 6.4: Intègre la détection et résolution de conflits

import { apiPatch } from './api';
import { offlineStorage, SyncQueueItem } from './offline_storage';

export interface SyncResult {
    success: boolean;
    processed: number;
    failed: number;
    errors: string[];
}

export interface SyncProgress {
    total: number;
    processed: number;
    failed: number;
    current?: string;
}

/**
 * Service de synchronisation pour les services spécialisés
 * Gère la queue de synchronisation et la synchronisation automatique
 */
class SyncService {
    private isSyncing = false;
    private syncListeners: ((progress: SyncProgress) => void)[] = [];

    /**
     * Ajouter un listener pour suivre la progression de la synchronisation
     */
    onSyncProgress(listener: (progress: SyncProgress) => void): () => void {
        this.syncListeners.push(listener);
        return () => {
            this.syncListeners = this.syncListeners.filter((l) => l !== listener);
        };
    }

    /**
     * Notifier les listeners de la progression
     */
    private notifyProgress(progress: SyncProgress) {
        this.syncListeners.forEach((listener) => listener(progress));
    }

    /**
     * Synchroniser la queue avec le backend
     */
    async syncQueue(): Promise<SyncResult> {
        if (this.isSyncing) {
            console.log('[SyncService] Synchronisation déjà en cours');
            return {
                success: false,
                processed: 0,
                failed: 0,
                errors: ['Synchronisation déjà en cours'],
            };
        }

        this.isSyncing = true;

        try {
            const queue = await offlineStorage.getSyncQueue();
            if (queue.length === 0) {
                this.isSyncing = false;
                return {
                    success: true,
                    processed: 0,
                    failed: 0,
                    errors: [],
                };
            }

            console.log(`[SyncService] \uD83D\uDE80 Début synchronisation de ${queue.length} éléments`);

            let processed = 0;
            let failed = 0;
            const errors: string[] = [];

            // Grouper les actions par type pour optimiser
            const actionsByType: Record<string, SyncQueueItem[]> = {};
            queue.forEach((item) => {
                if (!actionsByType[item.action]) {
                    actionsByType[item.action] = [];
                }
                actionsByType[item.action].push(item);
            });

            // Traiter chaque type d'action
            for (const [action, items] of Object.entries(actionsByType)) {
                this.notifyProgress({
                    total: queue.length,
                    processed,
                    failed,
                    current: `Synchronisation ${action}...`,
                });

                for (const item of items) {
                    try {
                        await this.processSyncItem(item);
                        await offlineStorage.removeFromSyncQueue(item.id);
                        processed++;
                        this.notifyProgress({
                            total: queue.length,
                            processed,
                            failed,
                            current: item.id,
                        });
                    } catch (error: any) {
                        console.error(`[SyncService] Erreur traitement item ${item.id}:`, error);

                        // ✅ Phase 6.4: Détecter si c'est un conflit
                        const errorMessage = error.message || error.toString();
                        if (errorMessage.includes('CONFLIT') || errorMessage.includes('conflict')) {
                            // C'est un conflit, ne pas incrémenter retries
                            failed++;
                            errors.push(`${item.id}: Conflit détecté - résolution manuelle requise`);
                            // Garder l'item dans la queue pour résolution manuelle
                            continue;
                        }

                        failed++;
                        errors.push(`${item.id}: ${errorMessage}`);

                        // Incrémenter le nombre de tentatives
                        item.retries++;
                        if (item.retries < 3) {
                            // Réessayer plus tard si moins de 3 tentatives
                            const updatedQueue = await offlineStorage.getSyncQueue();
                            const updatedItem = updatedQueue.find((q) => q.id === item.id);
                            if (updatedItem) {
                                updatedItem.retries = item.retries;
                                await offlineStorage.removeFromSyncQueue(item.id);
                                await offlineStorage.addToSyncQueue({
                                    action: item.action as any,
                                    service_id: item.service_id,
                                    data: item.data,
                                });
                            }
                        } else {
                            // Supprimer après 3 tentatives échouées
                            await offlineStorage.removeFromSyncQueue(item.id);
                        }
                    }
                }
            }

            // Mettre à jour la date de dernière synchronisation
            await offlineStorage.setLastSync(Date.now());

            console.log(`[SyncService] ✅ Synchronisation terminée: ${processed} traités, ${failed} échoués`);

            this.isSyncing = false;
            return {
                success: failed === 0,
                processed,
                failed,
                errors,
            };
        } catch (error: any) {
            console.error('[SyncService] Erreur synchronisation:', error);
            this.isSyncing = false;
            return {
                success: false,
                processed: 0,
                failed: 0,
                errors: [error.message || 'Erreur inconnue'],
            };
        }
    }

    /**
     * Traiter un élément de la queue
     * ✅ Phase 6.4: Inclut la détection de conflits
     */
    private async processSyncItem(item: SyncQueueItem): Promise<void> {
        switch (item.action) {
            case 'create':
                // TODO: Implémenter création via endpoint sync
                throw new Error('Création non implémentée dans sync');
            case 'update':
                if (!item.service_id || !item.data) {
                    throw new Error('Données manquantes pour update');
                }
                // ✅ Phase 6.4: Inclure timestamp local pour détection conflit
                const localUpdatedAt = item.data.updated_at || new Date().toISOString();
                const syncData = {
                    ...item.data,
                    local_updated_at: localUpdatedAt,
                };
                await apiPatch(`/api/specialized-services/${item.service_id}`, syncData);
                break;
            case 'delete':
                if (!item.service_id) {
                    throw new Error('service_id manquant pour delete');
                }
                // Utiliser l'endpoint batch pour la suppression
                await apiPatch('/api/specialized-services/batch', {
                    service_ids: [item.service_id],
                    action: 'delete',
                });
                break;
            case 'toggle_status':
                if (!item.service_id || !item.data?.is_active === undefined) {
                    throw new Error('Données manquantes pour toggle_status');
                }
                // ✅ Phase 6.4: Inclure timestamp local
                const toggleData = {
                    ...item.data,
                    local_updated_at: item.data.updated_at || new Date().toISOString(),
                };
                // Utiliser l'endpoint sync pour inclure la détection de conflit
                const { apiPost } = require('./api');
                await apiPost('/api/specialized-services/sync', {
                    actions: [{
                        action: 'toggle_status',
                        service_id: item.service_id,
                        data: toggleData,
                        local_updated_at: toggleData.local_updated_at,
                    }],
                });
                break;
            default:
                throw new Error(`Action non supportée: ${item.action}`);
        }
    }

    /**
     * Vérifier si une synchronisation est en cours
     */
    getIsSyncing(): boolean {
        return this.isSyncing;
    }

    /**
     * ✅ Phase 6.4: Résoudre un conflit
     */
    async resolveConflict(
        serviceId: number,
        resolution: 'use_local' | 'use_server' | 'merge' | 'cancel',
        localData?: any
    ): Promise<void> {
        try {
            const { apiPost } = require('./api');
            const response = await apiPost('/api/specialized-services/conflicts/resolve', {
                service_id: serviceId,
                resolution,
                local_data: localData,
            });
            const data = response.data || response;
            if (!data.success) {
                throw new Error(data.message || 'Erreur résolution conflit');
            }
        } catch (error: any) {
            console.error('[SyncService] Erreur résolution conflit:', error);
            throw error;
        }
    }
}

export const syncService = new SyncService();

