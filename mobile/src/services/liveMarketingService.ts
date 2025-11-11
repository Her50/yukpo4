import { apiPost } from './api';

interface LiveTeaserPayload {
    live_title: string;
    product_name?: string;
    product_highlights?: string[];
    audience_segment?: string;
    host_name?: string;
    tone?: string;
    offer?: string;
    duration_minutes?: number;
    language?: string;
}

interface LiveInvitesPayload {
    live_title: string;
    product_name?: string;
    audience_segments?: string[];
    value_proposition?: string;
    host_name?: string;
    language?: string;
}

interface LiveFollowupPayload {
    live_title: string;
    key_highlights?: string[];
    audience_reactions?: string;
    orders_count?: number;
    next_steps?: string;
    language?: string;
}

export const liveMarketingService = {
    generateTeaser: (payload: LiveTeaserPayload) =>
        apiPost('/api/live/ai/teaser', payload),
    generateInvites: (payload: LiveInvitesPayload) =>
        apiPost('/api/live/ai/invites', payload),
    generateFollowup: (payload: LiveFollowupPayload) =>
        apiPost('/api/live/ai/followup', payload),
};

export default liveMarketingService;


