import { apiGet, apiPost } from './apiService';

import type {
    StartVideoJobResponse,
    VideoCostEstimation,
    VideoGenerationPayload,
    VideoJobStatus,
} from '@/types/video';

export const fetchServiceDetails = async (serviceId: number) => {
    const response = await apiGet(`/api/services/${serviceId}`);
    return response.json();
};

export const fetchServiceMedia = async (serviceId: number) => {
    const response = await apiGet(`/api/services/${serviceId}/media`);
    return response.json();
};

export const estimateVideoCost = async (
    serviceId: number,
    productIndex: number,
    payload: VideoGenerationPayload,
): Promise<VideoCostEstimation> => {
    const response = await apiPost(
        `/api/media/product/${serviceId}/${productIndex}/estimate-video`,
        payload,
    );
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error || 'Estimation impossible');
    }
    return data;
};

export const startVideoGeneration = async (
    serviceId: number,
    productIndex: number,
    payload: VideoGenerationPayload,
): Promise<StartVideoJobResponse> => {
    const response = await apiPost(
        `/api/media/product/${serviceId}/${productIndex}/generate-video`,
        payload,
    );
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error || 'Impossible de lancer la génération');
    }
    return data;
};

export const fetchVideoJobStatus = async (jobId: string): Promise<VideoJobStatus> => {
    const response = await apiGet(`/api/media/jobs/${jobId}`);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error || 'Impossible de récupérer le statut du rendu');
    }
    return data;
};

