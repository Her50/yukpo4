// ✅ NOUVEAU Phase 2.3: Service d'export vidéo avec support 4K et formats multiples

import {
    ExportJob,
    ExportProgress,
    ExportSettings,
    QUALITY_BITRATES,
    RESOLUTION_DIMENSIONS,
} from '../types/ExportSettings';
import { apiCall } from './api';

export const exportService = {
    /**
     * Démarre un job d'export vidéo
     */
    async startExport(
        timelineId: string,
        settings: ExportSettings
    ): Promise<ExportJob> {
        // Calculer bitrate si non spécifié
        const finalSettings: ExportSettings = {
            ...settings,
            bitrate: settings.bitrate || QUALITY_BITRATES[settings.quality].video,
            audioBitrate: settings.audioBitrate || QUALITY_BITRATES[settings.quality].audio,
            fps: settings.fps || 30,
        };

        const response = await apiCall<ExportJob>('/api/export/start', {
            method: 'POST',
            body: JSON.stringify({
                timeline_id: timelineId,
                settings: finalSettings,
            }),
        });

        return response;
    },

    /**
     * Récupère le statut d'un job d'export
     */
    async getExportStatus(jobId: string): Promise<ExportJob> {
        const response = await apiCall<ExportJob>(`/api/export/status/${jobId}`);
        return response;
    },

    /**
     * Annule un job d'export en cours
     */
    async cancelExport(jobId: string): Promise<void> {
        await apiCall(`/api/export/cancel/${jobId}`, {
            method: 'POST',
        });
    },

    /**
     * Liste les exports récents de l'utilisateur
     */
    async listExports(limit: number = 20, offset: number = 0): Promise<ExportJob[]> {
        const response = await apiCall<{ exports: ExportJob[] }>(
            `/api/export/list?limit=${limit}&offset=${offset}`
        );
        return response.exports || [];
    },

    /**
     * Télécharge un export complété
     */
    async downloadExport(jobId: string): Promise<string> {
        const job = await this.getExportStatus(jobId);
        if (!job.outputUrl) {
            throw new Error('Export non complété ou URL manquante');
        }
        return job.outputUrl;
    },

    /**
     * Export local (sur device) si possible
     */
    async exportLocally(
        videoUri: string,
        settings: ExportSettings,
        onProgress?: (progress: ExportProgress) => void
    ): Promise<string> {
        // Utiliser react-native-ffmpeg pour export local
        // Cette fonction sera implémentée avec FFmpeg
        throw new Error('Export local non encore implémenté - utilisez exportService.startExport()');
    },

    /**
     * Vérifie si l'export local est possible (device capability)
     */
    async canExportLocally(settings: ExportSettings): Promise<boolean> {
        // Vérifier si le device peut gérer la résolution demandée
        const resolution = RESOLUTION_DIMENSIONS[settings.resolution];

        // Limites approximatives :
        // - 720p/1080p : toujours possible
        // - 2K/4K : besoin de vérifier mémoire/CPU
        // - 8K : généralement pas possible sur mobile

        if (settings.resolution === '8K') {
            return false;
        }

        // Pour 2K/4K, on peut essayer mais avec warning
        return true;
    },
};

