import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    createVoiceProfile as apiCreateVoiceProfile,
    deleteVoiceProfile as apiDeleteVoiceProfile,
    fetchVoiceProfiles,
} from '@/services/audioStudio';
import type { CreateVoiceProfilePayload, VoiceProfileSummary } from '@/types/audio';

interface UseVoiceProfilesOptions {
    serviceId?: number;
}

export const useVoiceProfiles = ({ serviceId }: UseVoiceProfilesOptions) => {
    const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfileSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadProfiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchVoiceProfiles();
            setVoiceProfiles(data);
        } catch (err: any) {
            console.error('[useVoiceProfiles] fetch error', err);
            setError(err?.message ?? 'Impossible de charger les profils audio');
        } finally {
            setLoading(false);
        }
    }, []);

    const createProfile = useCallback(
        async (payload: Omit<CreateVoiceProfilePayload, 'service_id'>) => {
            const request: CreateVoiceProfilePayload = {
                ...payload,
                service_id: serviceId,
            };
            const profile = await apiCreateVoiceProfile(request);
            setVoiceProfiles((prev) => [profile, ...prev]);
            return profile;
        },
        [serviceId],
    );

    const deleteProfile = useCallback(async (profileId: number) => {
        await apiDeleteVoiceProfile(profileId);
        setVoiceProfiles((prev) => prev.filter((profile) => profile.id !== profileId));
    }, []);

    useEffect(() => {
        void loadProfiles();
    }, [loadProfiles]);

    return useMemo(
        () => ({
            voiceProfiles,
            loading,
            error,
            refresh: loadProfiles,
            createProfile,
            deleteProfile,
        }),
        [createProfile, deleteProfile, error, loadProfiles, loading, voiceProfiles],
    );
};

