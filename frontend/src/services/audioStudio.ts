import { apiDelete, apiGet, apiPost } from './apiService';

import type { CreateVoiceProfilePayload, VoiceProfileSummary } from '@/types/audio';

export const fetchVoiceProfiles = async (): Promise<VoiceProfileSummary[]> => {
    const response = await apiGet('/api/audio-library/voice-profiles');
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error || 'Impossible de récupérer les profils audio');
    }
    return data?.profiles ?? data;
};

export const createVoiceProfile = async (
    payload: CreateVoiceProfilePayload,
): Promise<VoiceProfileSummary> => {
    const response = await apiPost('/api/audio-library/voice-profiles', payload);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error || 'Création de profil audio impossible');
    }
    return data;
};

export const deleteVoiceProfile = async (profileId: number): Promise<void> => {
    const response = await apiDelete(`/api/audio-library/voice-profiles/${profileId}`);
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Suppression du profil audio impossible');
    }
};

