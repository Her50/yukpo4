import { useCallback, useEffect, useMemo, useState } from 'react';

import { mediaApi } from '../services/api';
import type { CreateVoiceProfilePayload, VoiceProfileSummary } from '../types/audio';

interface UseVoiceProfilesOptions {
    serviceId?: number;
}

interface UseVoiceProfilesResult {
    voiceProfiles: VoiceProfileSummary[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createProfile: (
        payload: Omit<CreateVoiceProfilePayload, 'service_id'> & { sample_media_id?: number | null },
    ) => Promise<VoiceProfileSummary>;
    deleteProfile: (profileId: number) => Promise<void>;
}

type ApiResponse<T> = {
    success?: boolean;
    data?: T;
    error?: string;
};

const mapProfilesResponse = (response: ApiResponse<any>): VoiceProfileSummary[] => {
    if (!response || !response.data) {
        return [];
    }
    const payload = (response.data as { profiles?: VoiceProfileSummary[] }).profiles ?? response.data;
    return Array.isArray(payload) ? (payload as VoiceProfileSummary[]) : [];
};

export const useVoiceProfiles = ({ serviceId }: UseVoiceProfilesOptions = {}): UseVoiceProfilesResult => {
    const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfileSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await mediaApi.getVoiceProfiles();
            if (!response.success) {
                setError(response.error || 'Impossible de charger les profils audio');
                setVoiceProfiles([]);
                return;
            }
            setVoiceProfiles(mapProfilesResponse(response));
        } catch (err: any) {
            setError(err?.message || 'Erreur inattendue lors du chargement des profils audio');
            setVoiceProfiles([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const createProfile = useCallback(
        async (payload: Omit<CreateVoiceProfilePayload, 'service_id'> & { sample_media_id?: number | null }) => {
            const response = await mediaApi.createVoiceProfile({
                ...payload,
                service_id: serviceId,
            });
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Création de profil audio impossible');
            }
            const created = response.data as VoiceProfileSummary;
            setVoiceProfiles((prev) => [created, ...prev]);
            return created;
        },
        [serviceId],
    );

    const deleteProfile = useCallback(async (profileId: number) => {
        const response = await mediaApi.deleteVoiceProfile(profileId);
        if (!response.success) {
            throw new Error(response.error || 'Suppression de profil audio impossible');
        }
        setVoiceProfiles((prev) => prev.filter((profile) => profile.id !== profileId));
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return useMemo(
        () => ({
            voiceProfiles,
            loading,
            error,
            refresh,
            createProfile,
            deleteProfile,
        }),
        [createProfile, deleteProfile, error, loading, refresh, voiceProfiles],
    );
};

