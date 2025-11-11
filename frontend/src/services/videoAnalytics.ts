import { apiGet } from './apiService';

import type {
    ContentAnalyticsPayload,
    ContentAnalyticsResponseEnvelope,
    LiveAnalyticsEnvelope,
    LiveSessionAnalytics,
    LiveSessionRecord,
    VideoAnalyticsOverview,
    VideoAnalyticsOverviewResponseEnvelope,
} from '@/types/analytics';

const parseOverviewResponse = async (response: Response): Promise<VideoAnalyticsOverview> => {
    const payload: unknown = await response.json();

    if (!response.ok) {
        const errorMessage =
            (payload as { error?: string })?.error || (payload as { message?: string })?.message;
        throw new Error(errorMessage || 'video.analytics.error.overviewFetch');
    }

    const envelope = payload as VideoAnalyticsOverviewResponseEnvelope | VideoAnalyticsOverview;

    if ('success' in envelope) {
        if (envelope.success === false) {
            throw new Error(envelope.error || 'video.analytics.error.overviewFetch');
        }
        if (envelope.data) {
            return envelope.data;
        }
    }

    if (typeof (envelope as VideoAnalyticsOverview).horizon_days === 'number') {
        return envelope as VideoAnalyticsOverview;
    }

    throw new Error('video.analytics.error.invalidOverviewPayload');
};

const parseContentResponse = async (response: Response): Promise<ContentAnalyticsPayload> => {
    const payload: unknown = await response.json();

    if (!response.ok) {
        const errorMessage =
            (payload as { error?: string })?.error || (payload as { message?: string })?.message;
        throw new Error(errorMessage || 'video.analytics.error.contentFetch');
    }

    const envelope = payload as ContentAnalyticsResponseEnvelope | ContentAnalyticsPayload;

    if ('success' in envelope) {
        if (envelope.success === false || !envelope.data) {
            throw new Error(
                envelope.error || 'video.analytics.error.contentFetch',
            );
        }
        return envelope.data;
    }

    if ((envelope as ContentAnalyticsPayload)?.summary) {
        return envelope as ContentAnalyticsPayload;
    }

    throw new Error('video.analytics.error.invalidContentPayload');
};

const parseLiveResponse = async (
    response: Response,
): Promise<Array<{ session: LiveSessionRecord; metrics: LiveSessionAnalytics }>> => {
    const payload: unknown = await response.json();

    if (!response.ok) {
        const errorMessage =
            (payload as { error?: string })?.error || (payload as { message?: string })?.message;
        throw new Error(errorMessage || 'video.analytics.error.liveFetch');
    }

    const envelope = payload as LiveAnalyticsEnvelope | Array<{
        session: LiveSessionRecord;
        metrics: LiveSessionAnalytics;
    }>;

    if (Array.isArray(envelope)) {
        return envelope;
    }

    if (envelope.success === false) {
        throw new Error(envelope.error || 'video.analytics.error.liveFetch');
    }

    if (envelope.data) {
        return envelope.data;
    }

    return [];
};

export const fetchVideoAnalyticsOverview = async (
    params: { days?: number } = {},
): Promise<VideoAnalyticsOverview> => {
    const query = new URLSearchParams();
    if (params.days) {
        query.set('days', String(params.days));
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await apiGet(`/api/media/analytics/overview${suffix}`);
    return parseOverviewResponse(response);
};

export const fetchContentAnalytics = async (params: {
    days?: number;
    limit?: number;
} = {}): Promise<ContentAnalyticsPayload> => {
    const query = new URLSearchParams();
    if (params.days) {
        query.set('days', String(params.days));
    }
    if (params.limit) {
        query.set('limit', String(params.limit));
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';

    const response = await apiGet(`/api/media/analytics/content${suffix}`);
    return parseContentResponse(response);
};

export const fetchLiveAnalytics = async (params: {
    limit?: number;
} = {}): Promise<Array<{ session: LiveSessionRecord; metrics: LiveSessionAnalytics }>> => {
    const query = new URLSearchParams();
    if (params.limit) {
        query.set('limit', String(params.limit));
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';

    const response = await apiGet(`/api/live/analytics${suffix}`);
    return parseLiveResponse(response);
};

