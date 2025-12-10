// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';
import type { MusicMode } from '../types/audio';

export interface VideoDraft {
    serviceId: number;
    productIndex: number;
    productName?: string;
    serviceName?: string;
    brief: string;
    headline: string;
    callToAction: string;
    selectedMediaIds: number[];
    sceneAssignments: Record<string, number | null>;
    scenesDraft: Array<{ id: string; optional: boolean }>;
    storyTemplateId: string;
    stylePack: 'pulse' | 'story' | 'corporate';
    musicMode: MusicMode | 'pulse' | 'story' | 'corporate'; // ✅ Support des deux types
    voiceoverEnabled: boolean;
    voiceoverLang: 'fr' | 'en';
    selectedVoiceProfileId?: number;
    autoStoryboard: boolean;
    mode: 'standard' | 'expert';
    selectedStyle: string;
    publishChat: boolean;
    publishCard: boolean;
    publishSocial: boolean;
    timestamp: number;
}

const DRAFT_KEY = 'video_creation_draft';
const DRAFT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Sauvegarde automatique du brouillon avec debounce
 */
let saveTimeout: NodeJS.Timeout | null = null;

export const saveVideoDraft = async (draft: Partial<VideoDraft>): Promise<void> => {
    try {
        // Annuler le timeout précédent si existe
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }

        // Debounce de 2 secondes
        saveTimeout = setTimeout(async () => {
            try {
                const fullDraft: VideoDraft = {
                    ...draft,
                    timestamp: Date.now(),
                } as VideoDraft;

                await SafeStorage.setItem(DRAFT_KEY, JSON.stringify(fullDraft));
                console.log('[VideoDraftStorage] ✅ Brouillon sauvegardé');
            } catch (error) {
                console.error('[VideoDraftStorage] ❌ Erreur sauvegarde brouillon:', error);
            }
        }, 2000);
    } catch (error) {
        console.error('[VideoDraftStorage] ❌ Erreur préparation sauvegarde:', error);
    }
};

/**
 * Charge le brouillon s'il existe et est récent
 */
export const loadVideoDraft = async (): Promise<VideoDraft | null> => {
    try {
        const draftJson = await SafeStorage.getItem(DRAFT_KEY);
        if (!draftJson) {
            return null;
        }

        const draft: VideoDraft = JSON.parse(draftJson);

        // Vérifier si le brouillon est encore valide (< 24h)
        const age = Date.now() - draft.timestamp;
        if (age > DRAFT_MAX_AGE) {
            console.log('[VideoDraftStorage] ⏰ Brouillon expiré, suppression');
            await SafeStorage.removeItem(DRAFT_KEY);
            return null;
        }

        console.log('[VideoDraftStorage] ✅ Brouillon chargé (âge:', Math.round(age / 1000 / 60), 'minutes)');
        return draft;
    } catch (error) {
        console.error('[VideoDraftStorage] ❌ Erreur chargement brouillon:', error);
        return null;
    }
};

/**
 * Supprime le brouillon
 */
export const clearVideoDraft = async (): Promise<void> => {
    try {
        await SafeStorage.removeItem(DRAFT_KEY);
        console.log('[VideoDraftStorage] ✅ Brouillon supprimé');
    } catch (error) {
        console.error('[VideoDraftStorage] ❌ Erreur suppression brouillon:', error);
    }
};

/**
 * Vérifie si un brouillon existe
 */
export const hasVideoDraft = async (): Promise<boolean> => {
    try {
        const draft = await loadVideoDraft();
        return draft !== null;
    } catch (error) {
        return false;
    }
};

